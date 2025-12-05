import { useState, useEffect } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/clerk-react"
import { supabase } from './supabaseClient'
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom'

// --- 1. COMPONENT: EXPLORE (Public Search) ---
const Explore = () => {
  const [journals, setJournals] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase.from('journals').select('*').order('created_at', { ascending: false });
      setJournals(data || []);
    };
    fetchAll();
  }, []);

  const filtered = journals.filter(j => 
    j.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    j.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      <div className="navbar">
        <div className="logo" onClick={() => navigate('/')}>✈️ My Journal</div>
        <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
          <button onClick={() => navigate('/')} className="btn-teal" style={{padding:'8px 15px', fontSize:'0.9rem'}}>Back to Dashboard</button>
          <UserButton />
        </div>
      </div>
      <div className="dashboard-content-wrapper">
        <div style={{textAlign:'center', marginBottom:'30px'}}>
          <h1 style={{color:'#1a202c'}}>Explore the World 🌍</h1>
          <p style={{color:'#718096'}}>See where others are traveling.</p>
        </div>
        <div style={{marginBottom:'30px', display:'flex', justifyContent:'center'}}>
          <input type="text" placeholder="Search locations..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{width:'100%', maxWidth:'500px', padding:'15px', borderRadius:'50px', border:'1px solid #ddd'}} />
        </div>
        <div className="journal-grid">
          {filtered.map((j) => (
            <Link to={`/entry/${j.id}`} key={j.id} style={{textDecoration:'none'}}>
              <div className="travel-card">
                <div style={{position:'relative'}}>
                  {(j.image_url || (j.gallery && j.gallery.length > 0)) ? <img src={j.image_url || j.gallery[0]} className="card-img" /> : <div style={{width:'100%', height:'200px', background:'#f7fafc'}}></div>}
                </div>
                <div className="card-content"><h4 style={{margin:0, color:'#333'}}>{j.title}</h4><p style={{color:'#666', fontSize:'0.9rem'}}>📍 {j.location}</p></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

// --- 2. COMPONENT: DETAIL PAGE ---
const EntryDetail = () => {
  const { id } = useParams();
  const { user } = useUser();
  const [entry, setEntry] = useState(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const getEntry = async () => {
      const { data } = await supabase.from('journals').select('*').eq('id', id).single();
      setEntry(data);
    };
    getEntry();
  }, [id]);

  const isOwner = user && entry && user.id === entry.user_id;

  const handleDeletePhoto = async (url, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete photo?")) return;
    let update = {};
    if (url === entry.image_url) update.image_url = null;
    update.gallery = entry.gallery ? entry.gallery.filter(u => u !== url) : [];
    await supabase.from('journals').update(update).eq('id', id);
    setEntry({...entry, ...update});
  };

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const name = `${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
      await supabase.storage.from('journal-images').upload(name, file);
      const { data } = supabase.storage.from('journal-images').getPublicUrl(name);
      urls.push(data.publicUrl);
    }
    const update = { gallery: [...(entry.gallery || []), ...urls] };
    if (!entry.image_url && urls.length > 0) update.image_url = urls[0];
    await supabase.from('journals').update(update).eq('id', id);
    setEntry({...entry, gallery: update.gallery, image_url: update.image_url || entry.image_url});
    setUploading(false);
  };

  if (!entry) return <div style={{padding:'50px', textAlign:'center'}}>Loading...</div>;
  const images = [];
  if (entry.image_url) images.push(entry.image_url);
  if (entry.gallery) entry.gallery.forEach(i => { if (i !== entry.image_url) images.push(i); });

  return (
    <div>
      <div className="navbar"><div className="logo" onClick={() => navigate('/')}>✈️ My Journal</div><UserButton /></div>
      <div className="detail-container">
        <div>
          <button onClick={() => navigate('/')} className="back-btn">← Back</button>
          <div className="story-card">
            <div style={{display:'flex', justifyContent:'space-between'}}><span className="story-badge">📍 {entry.location}</span><span style={{color:'#94a3b8'}}>{new Date(entry.created_at).toLocaleDateString()}</span></div>
            <h1 className="story-title">{entry.title}</h1>
            <hr style={{borderTop:'1px solid #eee', margin:'20px 0'}} /><div className="story-text">{entry.description}</div>
          </div>
        </div>
        <div className="photo-stack">
          {images.map((img, i) => (
            <div key={i} className="photo-card" style={{position:'relative'}}>
              <img src={img} className="photo-card-img" onClick={() => window.open(img, '_blank')} />
              {isOwner && <button className="delete-btn-gallery" onClick={(e) => handleDeletePhoto(img, e)}>✕</button>}
            </div>
          ))}
          {isOwner && (
            <label className="photo-card" style={{border:'2px dashed #cbd5e0', boxShadow:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'150px'}}>
              <input type="file" multiple accept="image/*" onChange={handleAddPhotos} style={{display:'none'}} disabled={uploading} />
              {uploading ? <span style={{color:'#00897b'}}>Uploading...</span> : <><span style={{fontSize:'2rem', color:'#cbd5e0'}}>+</span><span style={{color:'#94a3b8'}}>Add Photo</span></>}
            </label>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

// --- 3. COMPONENT: DASHBOARD ---
const Dashboard = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [journals, setJournals] = useState([]);
  const [newEntry, setNewEntry] = useState({ title: '', location: '', description: '' });
  const [imageFiles, setImageFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => { if (user) fetchJournals(); }, [user]);

  const fetchJournals = async () => {
    const { data } = await supabase.from('journals').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setJournals(data || []);
  };

  const handleLocationChange = async (e) => {
    const value = e.target.value;
    setNewEntry({ ...newEntry, location: value });
    if (value.length > 2) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${value}&limit=5`);
        const data = await res.json();
        setSuggestions(data); setShowSuggestions(true);
      } catch (e) {}
    } else { setSuggestions([]); setShowSuggestions(false); }
  };

  const handleUploads = async () => {
    if (imageFiles.length === 0) return { main: null, gal: [] };
    setUploading(true);
    const urls = [];
    for (const file of imageFiles) {
      const name = `${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
      await supabase.storage.from('journal-images').upload(name, file);
      const { data } = supabase.storage.from('journal-images').getPublicUrl(name);
      urls.push(data.publicUrl);
    }
    setUploading(false);
    return { main: urls[0], gal: urls };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newEntry.title) return alert("Title required");
    const { main, gal } = await handleUploads();
    await supabase.from('journals').insert([{ user_id: user.id, ...newEntry, image_url: main, gallery: gal }]);
    setNewEntry({ title: '', location: '', description: '' }); setImageFiles([]); document.getElementById('fileInput').value = ""; fetchJournals();
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if(window.confirm("Delete this memory?")) { await supabase.from('journals').delete().eq('id', id); fetchJournals(); }
  };

  const filtered = journals.filter(j => j.title.toLowerCase().includes(searchTerm.toLowerCase()) || j.location.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="dashboard-container">
      <div className="navbar"><div className="logo">✈️ My Journal</div><UserButton /></div>
      <div className="dashboard-content-wrapper">
        <div style={{ width: '100%', height: '250px', borderRadius: '20px', marginBottom: '40px', overflow: 'hidden', position: 'relative', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
          <img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(255, 255, 255, 0.85)', padding: '15px 25px', borderRadius: '20px', backdropFilter: 'blur(5px)' }}>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: '#00897b' }}>Where to next? 🌏</h2>
            <button onClick={() => navigate('/explore')} style={{background:'var(--primary-teal)', color:'white', border:'none', padding:'8px 12px', borderRadius:'50px', cursor:'pointer', fontWeight:'bold', fontSize:'0.85rem'}}>
              Explore Public Trips →
            </button>
          </div>
        </div>
        <div className="entry-form-card">
          <h3>Add a New Adventure</h3>
          <form onSubmit={handleSubmit}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'15px'}}>
              <input type="text" placeholder="Trip Title" value={newEntry.title} onChange={(e) => setNewEntry({...newEntry, title: e.target.value})} />
              <div className="location-wrapper">
                <input type="text" placeholder="Location..." value={newEntry.location} onChange={handleLocationChange} autoComplete="off"/>
                {showSuggestions && suggestions.length > 0 && <ul className="suggestions-list">{suggestions.map(p => <li key={p.place_id} onClick={() => {setNewEntry({...newEntry, location: p.display_name}); setSuggestions([]);}} className="suggestion-item">📍 {p.display_name}</li>)}</ul>}
              </div>
            </div>
            <textarea rows="3" placeholder="Description..." value={newEntry.description} onChange={(e) => setNewEntry({...newEntry, description: e.target.value})} />
            <div style={{display:'flex', alignItems:'center', marginTop:'10px', gap:'10px'}}>
              <input id="fileInput" type="file" multiple accept="image/*" onChange={(e) => setImageFiles(Array.from(e.target.files))} />
              <button className="btn-teal" disabled={uploading}>{uploading ? "..." : "Save"}</button>
            </div>
          </form>
        </div>
        <div style={{ marginBottom: '30px' }}><input type="text" placeholder="🔍 Search trips..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '50px', border: '1px solid #ddd' }} /></div>
        <div className="journal-grid">
          {filtered.map((j) => (
            <Link to={`/entry/${j.id}`} key={j.id} style={{textDecoration:'none'}}>
              <div className="travel-card">
                <div style={{position:'relative'}}>
                  {(j.image_url || (j.gallery && j.gallery.length > 0)) ? <img src={j.image_url || j.gallery[0]} className="card-img" /> : <div style={{width:'100%', height:'200px', background:'#f7fafc'}}></div>}
                  <button className="delete-btn" onClick={(e) => handleDelete(e, j.id)}>🗑️</button>
                </div>
                <div className="card-content"><h4 style={{margin:0, color:'#333'}}>{j.title}</h4><p style={{color:'#666', fontSize:'0.9rem'}}>📍 {j.location}</p></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

const Footer = () => <footer className="footer"><div className="footer-links"><a href="#">Feedback</a><span>|</span><a href="#">Contact</a><span>|</span><a href="#">Support</a></div><p style={{marginTop:'10px', fontSize:'0.8rem'}}>© 2024 Travel Journal</p></footer>;

// --- 4. MAIN APP ---
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <>
            <SignedOut>
              {/* --- 1. CLEAN LANDING PAGE (Text removed) --- */}
              <div className="landing-page">
                <nav className="navbar">
                  <div className="logo">✈️ Travel Journal</div>
                  <SignInButton mode="modal">
                    <button className="btn-teal">Sign In</button>
                  </SignInButton>
                </nav>

                <div className="hero-content">
                  {/* Text Removed Here - Only Images Remain */}
                  {/* ... inside the SignedOut section ... */}
            <div className="hero-content">
              
              {/* Note: I removed the old "hero-actions" button since we moved it inside the card */}
              
              <div className="hero-images">
                {/* Left Image */}
                <img 
                  src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800" 
                  alt="Mountains" 
                  className="hero-img img-left" 
                />

                {/* --- NEW CENTER CARD --- */}
                <div className="hero-center-card">
                  <h1 className="hero-card-title">Capture Your Journeys</h1>
                  <p className="hero-card-subtitle">Track trips, memories, photos & more.</p>
                  
                  <SignInButton mode="modal">
                    <button className="btn-orange">Start Exploring</button>
                  </SignInButton>
                </div>

                {/* Right Image */}
                <img 
                  src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800" 
                  alt="Beach" 
                  className="hero-img img-right" 
                />
              </div>
            </div>
                </div>
                <Footer />
              </div>
            </SignedOut>
            <SignedIn>
              <Dashboard />
            </SignedIn>
          </>
        } />
        <Route path="/entry/:id" element={<SignedIn><EntryDetail /></SignedIn>} />
        <Route path="/explore" element={<Explore />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App