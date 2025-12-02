import { useState, useEffect } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/clerk-react"
import { supabase } from './supabaseClient'
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom'

// --- 1. COMPONENT: DETAIL PAGE (With Gallery) ---
const EntryDetail = () => {
  const { id } = useParams();
  const [entry, setEntry] = useState(null);
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

  if (!entry) return <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#fdfbf7'}}>Loading Memory...</div>;

  return (
    <div className="detail-page-container">
      {/* Floating Back Button */}
      <button onClick={() => navigate('/')} className="back-btn-floating">
        ← Back
      </button>

      {/* Main Banner (First Image) */}
      <div className="detail-hero-banner">
        {entry.image_url ? (
          <img src={entry.image_url} alt={entry.title} className="detail-hero-img" />
        ) : (
          <div style={{width:'100%', height:'100%', background: 'linear-gradient(135deg, #00897b, #4db6ac)'}} />
        )}
      </div>

      {/* Story Card */}
      <div className="detail-content-card">
        <h1 className="detail-title">{entry.title}</h1>
        
        <div className="detail-meta-row">
          <span className="detail-badge">📍 {entry.location}</span>
          <span className="detail-date">
            Travelled on {new Date(entry.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>

        <div className="detail-description">
          {entry.description}
        </div>

        {/* --- PHOTO GALLERY SECTION --- */}
        {entry.gallery && entry.gallery.length > 0 && (
          <div className="detail-gallery-section">
            <h3 className="gallery-title">📸 Photo Gallery</h3>
            <div className="gallery-grid">
              {entry.gallery.map((imgLink, index) => (
                <img 
                  key={index} 
                  src={imgLink} 
                  alt={`Gallery ${index}`} 
                  className="gallery-img"
                  onClick={() => window.open(imgLink, '_blank')} // Click to open full size
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

// --- 2. COMPONENT: DASHBOARD (Main Page) ---
const Dashboard = () => {
  const { user } = useUser();
  const [journals, setJournals] = useState([]);
  const [newEntry, setNewEntry] = useState({ title: '', location: '', description: '' });
  
  // State for multiple files
  const [imageFiles, setImageFiles] = useState([]); 
  const [uploading, setUploading] = useState(false);
  
  // Search & Autocomplete State
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (user) fetchJournals();
  }, [user]);

  const fetchJournals = async () => {
    const { data, error } = await supabase
      .from('journals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) console.error("Error fetching:", error);
    else setJournals(data);
  };

  // Location Autocomplete Logic
  const handleLocationChange = async (e) => {
    const value = e.target.value;
    setNewEntry({ ...newEntry, location: value });

    if (value.length > 2) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${value}&limit=5`);
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch (error) { console.error(error); }
    } else {
      setSuggestions([]); setShowSuggestions(false);
    }
  };

  const selectLocation = (placeName) => {
    setNewEntry({ ...newEntry, location: placeName });
    setSuggestions([]); setShowSuggestions(false);
  };

  // Multi-File Upload Logic
  const handleUploads = async () => {
    if (imageFiles.length === 0) return { mainUrl: null, galleryUrls: [] };
    
    setUploading(true);
    const uploadedUrls = [];

    for (const file of imageFiles) {
      // Sanitize file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error } = await supabase.storage.from('journal-images').upload(filePath, file);
      
      if (error) {
        alert(`Error uploading ${file.name}: ` + error.message);
        continue; 
      }

      const { data } = supabase.storage.from('journal-images').getPublicUrl(filePath);
      uploadedUrls.push(data.publicUrl);
    }
    setUploading(false);
    
    // Return first image as "Main Cover" and ALL images as "Gallery List"
    return { 
      mainUrl: uploadedUrls[0] || null, 
      galleryUrls: uploadedUrls 
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newEntry.title) return alert("Title is required");

    const { mainUrl, galleryUrls } = await handleUploads();

    const { error } = await supabase.from('journals').insert([{
      user_id: user.id,
      title: newEntry.title,
      location: newEntry.location,
      description: newEntry.description,
      image_url: mainUrl,   // Cover Photo
      gallery: galleryUrls  // Full Gallery List
    }]);

    if (error) {
      console.error(error); alert("Error saving entry.");
    } else {
      setNewEntry({ title: '', location: '', description: '' });
      setImageFiles([]);
      // Reset file input visually
      document.getElementById('fileInput').value = ""; 
      fetchJournals();
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Prevent click from opening the detail page
    if(window.confirm("Are you sure you want to delete this memory?")) {
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
      <header className="navbar">
        <div className="logo">✈️ My Journal</div>
        <UserButton />
      </header>

      <div className="dashboard-content-wrapper">
        
        {/* Dashboard Banner */}
        <div style={{ width: '100%', height: '250px', borderRadius: '20px', marginBottom: '40px', overflow: 'hidden', position: 'relative', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
          <img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(255, 255, 255, 0.85)', padding: '10px 25px', borderRadius: '50px', backdropFilter: 'blur(5px)' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#00897b' }}>Where to next? 🌏</h2>
          </div>
        </div>

        {/* Entry Form */}
        <div className="entry-form-card">
          <h3>Add a New Adventure</h3>
          <form onSubmit={handleSubmit}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'15px'}}>
              <input type="text" placeholder="Trip Title" value={newEntry.title} onChange={(e) => setNewEntry({...newEntry, title: e.target.value})} />
              
              {/* Location with Autocomplete */}
              <div className="location-wrapper">
                <input type="text" placeholder="Location (Type to search...)" value={newEntry.location} onChange={handleLocationChange} autoComplete="off"/>
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="suggestions-list">
                    {suggestions.map((place) => (
                      <li key={place.place_id} onClick={() => selectLocation(place.display_name)} className="suggestion-item">
                        📍 {place.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            
            <textarea rows="3" placeholder="Description..." value={newEntry.description} onChange={(e) => setNewEntry({...newEntry, description: e.target.value})} />
            
            <div style={{display:'flex', alignItems:'center', gap:'10px', marginTop:'10px'}}>
              {/* Multiple File Input */}
              <input 
                id="fileInput"
                type="file" 
                multiple 
                accept="image/*" 
                onChange={(e) => setImageFiles(Array.from(e.target.files))} 
                style={{border:'none', padding:0}} 
              />
              <button className="btn-teal btn-large" style={{marginLeft:'auto'}} disabled={uploading}>
                {uploading ? "Uploading..." : "Save Entry"}
              </button>
            </div>
            {imageFiles.length > 0 && <p style={{fontSize:'0.8rem', color:'#666', marginTop:'5px'}}>{imageFiles.length} photos selected</p>}
          </form>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '30px' }}>
          <input type="text" placeholder="🔍 Search trips..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '50px', border: '1px solid #ddd', boxShadow:'0 4px 10px rgba(0,0,0,0.05)', fontSize: '1.1rem' }} />
        </div>

        {/* Gallery Grid */}
        <div className="journal-grid">
          {filteredJournals.length > 0 ? (
            filteredJournals.map((j) => (
              <Link to={`/entry/${j.id}`} key={j.id} style={{textDecoration:'none'}}>
                <div className="travel-card">
                  <button onClick={(e) => handleDelete(e, j.id)} className="delete-btn">🗑️</button>
                  <div className="card-image-box">
                    {j.image_url ? <img src={j.image_url} className="card-img" /> : <div style={{width:'100%', height:'100%', background:'#f7fafc'}}></div>}
                  </div>
                  <div className="card-content">
                    <span className="card-loc">📍 {j.location}</span>
                    <h4 className="card-title">{j.title}</h4>
                    <p className="card-desc">{j.description}</p>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <p style={{gridColumn:'1/-1', textAlign:'center', color:'#888'}}>No trips found.</p>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

// --- 3. COMPONENT: FOOTER ---
const Footer = () => (
  <footer className="footer">
    <div className="footer-content">
      <div className="footer-links">
        <a href="#" className="footer-link">Feedback</a><span style={{color:'#cbd5e0'}}>|</span>
        <a href="mailto:support@traveljournal.com" className="footer-link">Contact</a><span style={{color:'#cbd5e0'}}>|</span>
        <a href="#" className="footer-link">Support</a>
      </div>
      <p className="copyright">© 2024 Travel Journal.</p>
    </div>
  </footer>
);

// --- 4. MAIN APP ROUTING ---
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <>
            <SignedOut>
              <div className="landing-page">
                <nav className="navbar">
                  <div className="logo">✈️ Travel Journal</div>
                  <SignInButton mode="modal"><button className="btn-teal">Sign In</button></SignInButton>
                </nav>
                <div className="hero-content">
                  <div className="hero-actions">
                    <SignInButton mode="modal"><button className="btn-teal btn-large">Start Journaling</button></SignInButton>
                  </div>
                  <div className="hero-images">
                    <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800" className="hero-img img-left" />
                    <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800" className="hero-img img-right" />
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
      </Routes>
    </BrowserRouter>
  )
}

export default App