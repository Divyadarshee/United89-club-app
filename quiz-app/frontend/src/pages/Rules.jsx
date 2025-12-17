import { useNavigate } from 'react-router-dom';

function Rules() {
    const navigate = useNavigate();

    return (
        <div className="card">
            <h1>Rules</h1>
            <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                <ul style={{ lineHeight: '1.6', paddingLeft: '20px' }}>
                    <li>You have <strong>10 minutes</strong> to complete the quiz.</li>
                    <li>Once you start, the timer cannot be paused.</li>
                    <li>Each question has one correct answer.</li>
                    <li>The quiz will auto-submit when the time is up.</li>
                    <li>Good luck!</li>
                </ul>
            </div>
            <button onClick={() => {
                const hasSubmitted = localStorage.getItem('has_submitted') === 'true';
                if (hasSubmitted) {
                    alert("You have already completed this quiz!");
                    navigate('/thank-you');
                } else {
                    navigate('/quiz');
                }
            }}>
                Start Quiz
            </button>
        </div>
    );
}

export default Rules;
