import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../services/api';

function Home() {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim()) return;

        setLoading(true);
        try {
            const data = await registerUser(name, phone);
            localStorage.setItem('user_id', data.user_id);
            localStorage.setItem('has_submitted', data.has_submitted);

            if (data.resuming && !data.has_submitted) {
                alert("Welcome back! Resuming your session.");
            }
            navigate('/rules');
        } catch (error) {
            console.error('Registration failed:', error);
            alert(error.response?.data?.detail || 'Registration failed. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <h1>Quiz Show</h1>
            <p className="mb-4">Enter your details to begin the challenge.</p>
            <form onSubmit={handleSubmit} className="flex-col">
                <input
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                />
                <input
                    type="tel"
                    placeholder="Phone Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={loading}
                />
                <button type="submit" disabled={loading}>
                    {loading ? 'Registering...' : 'Enter Quiz'}
                </button>
            </form>
        </div>
    );
}

export default Home;
