import { useState, useEffect } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/clerk-react"
import { supabase } from './supabaseClient'
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom'

// --- 1. COMPONENT: DETAIL PAGE (With Delete Photo) ---
const EntryDetail = () => {
  const { id } = useParams();
  const [entry, setEntry] = useState(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getEntry();
  }, [id]);

  const getEntry = async () => {
    const { data, error } = await supabase
      .from('journals')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) console.error(error);
    else setEntry(data);
  };

  const handleDeletePhoto = async (urlToDelete, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this photo?")) return;

    let updateData = {};

    // If deleting the Main Image, set it to null
    if (urlToDelete === entry.image_url) {
      updateData.image_url = null;
    } 
    // Always remove it from the gallery list too
    const newGallery = entry.gallery ? entry.gallery.filter(url => url !== urlToDelete) : [];
    updateData.gallery = newGallery;

    const { error } = await supabase.from('journals').update(updateData).eq('id', id);

    if (error) alert("Error deleting photo: " + error.message);
    else getEntry();
  };

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    const newUrls = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error } = await supabase.storage.from('journal-images').upload(fileName, file);
      if (!error) {
        const { data } = supabase.storage.from('journal-images').getPublicUrl(fileName);
        newUrls.push(data.publicUrl);
      }
    }

    // If there was no main image before, make the first new photo the main image
    let updateData = {};
    if (!entry.image_url && newUrls.length > 0) {
        updateData.image_url = newUrls[0];
    }

    const currentGallery = entry.gallery || [];
    updateData.gallery = [...currentGallery, ...newUrls];

    const { error: dbError } = await supabase.from('journals').update(updateData).eq('id', id);
    if (!dbError) getEntry();
    setUploading(false);
  };

  if (!entry) return <div style={{padding:'50px', textAlign:'center'}}>Loading Memory...</div>;

  // Combine unique images for display
  const allImages = [];
  if (entry.image_url) allImages.push(entry.image_url);
  if (entry.gallery) {
      entry.gallery.forEach(img => {
          if (img !== entry.image_url) allImages.push(img);
      });
  }

  return (
    <div>
      <div className="navbar">
        <div className="logo" onClick={() => navigate('/')}>✈️ My Journal</div>
        <UserButton />
      </div>

      <div className="detail-container">
        {/* Left Column: Story */}
        <div>
          <button onClick={() => navigate('/')} className="back-btn">← Back to Dashboard</button>
          <div className="story-card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <span className="story-badge">📍 {entry.location}</span>
              <span style={{color:'#94a3b8', fontSize:'0.9rem'}}>{new Date(entry.created_at).toLocaleDateString()}</span>
            </div>
            <h1 className="story-title">{entry.title}</h1>
            <hr style={{border:'0', borderTop:'1px solid #eee', margin:'20px 0'}} />
            <div className="story-text">{entry.description}</div>
          </div>
        </div>

        {/* Right Column: Photos */}
        <div className="photo-stack">
          {allImages.length > 0 ? (
            allImages.map((img, index) => (
              <div key={index} className="photo-card" style={{position:'relative'}}>
                <img 
                  src={img} 
                  alt="Memory" 
                  className="photo-card-img" 
                  onClick={() => window.open(img, '_blank')} 
                  style={{cursor:'zoom-in'}}
                />
                <button className="delete-btn-gallery" onClick={(e) => handleDeletePhoto(img, e)} title="Delete this photo">✕</button>
              </div>
            ))
          ) : (
            <div className="photo-card" style={{height:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:'#cbd5e0'}}>
              No Photos Added
            </div>
          )}
          
          <label className="photo-card" style={{border:'2px dashed #cbd5e0', boxShadow:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'150px'}}>
            <input type="file" multiple accept="image/*" onChange={handleAddPhotos} style={{display:'none'}} disabled={uploading} />
            {uploading ? <span style={{color:'#00897b', fontWeight:'600'}}>Uploading...</span> : <><span style={{fontSize:'2rem', color:'#cbd5e0'}}>+</span><span style={{color:'#94a3b8', fontWeight:'600'}}>Add Photo</span></>}
          </label>
        </div>
      </div>
      <Footer />
    </div>
  );
};

// --- 2. COMPONENT: DASHBOARD ---
const Dashboard = () => {
  const { user } = useUser();
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
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${value}&limit=5`);
        const data = await response.json();
        setSuggestions(data); setShowSuggestions(true);
      } catch (error) { console.error(error); }
    } else { setSuggestions([]); setShowSuggestions(false); }
  };

  const selectLocation = (placeName) => {
    setNewEntry({ ...newEntry, location: placeName }); setSuggestions([]); setShowSuggestions(false);
  };

  const handleUploads = async () => {
    if (imageFiles.length === 0) return { mainUrl: null, galleryUrls: [] };
    setUploading(true);
    const uploadedUrls = [];
    for (const file of imageFiles) {
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
      await supabase.storage.from('journal-images').upload(fileName, file);
      const { data } = supabase.storage.from('journal-images').getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
    }
    setUploading(false);
    return { mainUrl: uploadedUrls[0], galleryUrls: uploadedUrls };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newEntry.title) return alert("Title required");
    const { mainUrl, galleryUrls } = await handleUploads();
    await supabase.from('journals').insert([{ user_id: user.id, ...newEntry, image_url: mainUrl, gallery: galleryUrls }]);
    setNewEntry({ title: '', location: '', description: '' }); setImageFiles([]); document.getElementById('fileInput').value = ""; fetchJournals();
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if(window.confirm("Delete this memory?")) {
      await supabase.from('journals').delete().eq('id', id);
      fetchJournals();
    }
  };

  const filteredJournals = journals.filter(j => 
    j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      <div className="navbar"><div className="logo">✈️ My Journal</div><UserButton /></div>
      <div className="dashboard-content-wrapper">
        <div style={{ width: '100%', height: '250px', borderRadius: '20px', marginBottom: '40px', overflow: 'hidden', position: 'relative', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
          <img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(255, 255, 255, 0.85)', padding: '10px 25px', borderRadius: '50px', backdropFilter: 'blur(5px)' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#00897b' }}>Where to next? 🌏</h2>
          </div>
        </div>
        <div className="entry-form-card">
          <h3>Add a New Adventure</h3>
          <form onSubmit={handleSubmit}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'15px'}}>
              <input type="text" placeholder="Trip Title" value={newEntry.title} onChange={(e) => setNewEntry({...newEntry, title: e.target.value})} />
              <div className="location-wrapper">
                <input type="text" placeholder="Location..." value={newEntry.location} onChange={handleLocationChange} autoComplete="off"/>
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="suggestions-list">
                    {suggestions.map((place) => <li key={place.place_id} onClick={() => selectLocation(place.display_name)} className="suggestion-item">📍 {place.display_name}</li>)}
                  </ul>
                )}
              </div>
            </div>
            <textarea rows="3" placeholder="Description..." value={newEntry.description} onChange={(e) => setNewEntry({...newEntry, description: e.target.value})} />
            <div style={{display:'flex', alignItems:'center', marginTop:'10px', gap:'10px'}}>
              <input id="fileInput" type="file" multiple accept="image/*" onChange={(e) => setImageFiles(Array.from(e.target.files))} />
              <button className="btn-teal" disabled={uploading}>{uploading ? "..." : "Save"}</button>
            </div>
            {imageFiles.length > 0 && <p style={{fontSize:'0.8rem', color:'#666'}}>{imageFiles.length} photos selected</p>}
          </form>
        </div>
        <div style={{ marginBottom: '30px' }}>
          <input type="text" placeholder="🔍 Search trips..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '50px', border: '1px solid #ddd', fontSize: '1.1rem' }} />
        </div>
        <div className="journal-grid">
          {filteredJournals.map((j) => (
            <Link to={`/entry/${j.id}`} key={j.id} style={{textDecoration:'none'}}>
              <div className="travel-card">
                <div style={{position:'relative'}}>
                  
                  {/* --- UPDATED LOGIC HERE: Show Main Image OR First Gallery Image --- */}
                  {(j.image_url || (j.gallery && j.gallery.length > 0)) ? (
                    <img src={j.image_url || j.gallery[0]} className="card-img" />
                  ) : (
                    <div style={{width:'100%', height:'200px', background:'#f7fafc', display:'flex', alignItems:'center', justifyContent:'center', color:'#cbd5e0'}}>No Photo</div>
                  )}

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

const Footer = () => (
  <footer className="footer">
    <div className="footer-links"><a href="#">Feedback</a><span>|</span><a href="#">Contact</a><span>|</span><a href="#">Support</a></div>
    <p style={{marginTop:'10px', fontSize:'0.8rem'}}>© 2024 Travel Journal</p>
  </footer>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<><SignedOut><div className="landing-page"><div className="navbar"><div className="logo">✈️ Travel Journal</div><SignInButton mode="modal"><button className="btn-teal">Sign In</button></SignInButton></div><div className="hero-content"><h1>Capture Your Journey</h1><div className="hero-actions"><SignInButton mode="modal"><button className="btn-teal">Start Now</button></SignInButton></div></div><Footer /></div></SignedOut><SignedIn><Dashboard /></SignedIn></>} />
        <Route path="/entry/:id" element={<SignedIn><EntryDetail /></SignedIn>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App