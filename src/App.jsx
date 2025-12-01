import { useState, useEffect } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/clerk-react"
import { supabase } from './supabaseClient'

// --- FOOTER COMPONENT (New) ---
const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-links">
          <a href="#" className="footer-link" onClick={(e) => {e.preventDefault(); alert("Thanks for your feedback!")}}>Feedback</a>
          <span style={{color:'#cbd5e0'}}>|</span>
          <a href="mailto:support@traveljournal.com" className="footer-link">Contact</a>
          <span style={{color:'#cbd5e0'}}>|</span>
          <a href="#" className="footer-link" onClick={(e) => {e.preventDefault(); alert("Help Center coming soon!")}}>Support</a>
        </div>
        <p className="copyright">© 2024 Travel Journal. Made with 💜.</p>
      </div>
    </footer>
  );
};

function App() {
  const { user } = useUser();
  const [journals, setJournals] = useState([]);
  const [newEntry, setNewEntry] = useState({ title: '', location: '', description: '' });
  const [imageFile, setImageFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Location Suggestions State
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
    if (error) console.error(error);
    else setJournals(data);
  };

  // Location Autocomplete
  const handleLocationChange = async (e) => {
    const value = e.target.value;
    setNewEntry({ ...newEntry, location: value });

    if (value.length > 2) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${value}&limit=5`);
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectLocation = (placeName) => {
    setNewEntry({ ...newEntry, location: placeName });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Upload Logic
  const handleUpload = async () => {
    if (!imageFile) return null;
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;
    const { error } = await supabase.storage.from('journal-images').upload(filePath, imageFile);
    if (error) { alert("Error uploading: " + error.message); return null; }
    const { data } = supabase.storage.from('journal-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newEntry.title) return alert("Title is required");
    let imageUrl = null;
    if (imageFile) imageUrl = await handleUpload();
    await supabase.from('journals').insert([{
      user_id: user.id, title: newEntry.title, location: newEntry.location, description: newEntry.description, image_url: imageUrl
    }]);
    setNewEntry({ title: '', location: '', description: '' });
    setImageFile(null);
    fetchJournals();
  };

  const handleDelete = async (id) => {
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
          {/* Footer added here */}
          <Footer />
        </div>
      </SignedOut>

      <SignedIn>
        <div className="dashboard-container">
          <header className="navbar">
            <div className="logo">✈️ My Journal</div>
            <UserButton />
          </header>

          <div className="dashboard-content-wrapper">
            <div style={{
              width: '100%', height: '250px', borderRadius: '20px', marginBottom: '40px', overflow: 'hidden', position: 'relative', boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
            }}>
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
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} style={{border:'none', padding:0}} />
                  <button className="btn-teal btn-large" style={{marginLeft:'auto'}}>Save Entry</button>
                </div>
              </form>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <input type="text" placeholder="🔍 Search your trips..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '50px', border: '1px solid #ddd', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', fontSize: '1.1rem' }} />
            </div>

            <div className="journal-grid">
              {filteredJournals.map((j) => (
                <div key={j.id} className="travel-card">
                  <button onClick={() => handleDelete(j.id)} className="delete-btn">🗑️</button>
                  <div className="card-image-box">
                    {j.image_url ? <img src={j.image_url} className="card-img" /> : <div style={{width:'100%', height:'100%', background:'#f7fafc'}}></div>}
                  </div>
                  <div className="card-content">
                    <span className="card-loc">📍 {j.location}</span>
                    <h4 className="card-title">{j.title}</h4>
                    <p className="card-desc">{j.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Footer added here */}
          <Footer />
        </div>
      </SignedIn>
    </>
  )
}

export default App