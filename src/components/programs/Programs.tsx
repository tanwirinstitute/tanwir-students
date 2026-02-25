import React, { useEffect, useState } from 'react';
import { ProgramService, ProgramStats } from '../../services/programs/programService';
import { ProgramDetail } from './ProgramDetail';
import '../../styles/programs.css';

export const Programs: React.FC = () => {
  const [programStats, setProgramStats] = useState<ProgramStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<ProgramStats | null>(null);

  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        setLoading(true);
        const programService = ProgramService.getInstance();
        const stats = await programService.getProgramStats();
        setProgramStats(stats);
        setError(null);
      } catch (err) {
        console.error('Error fetching programs:', err);
        setError('Failed to load programs. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPrograms();
  }, []);

  const handleSelectProgram = (program: ProgramStats) => {
    setSelectedProgram(program);
  };

  const handleCloseDetail = () => {
    setSelectedProgram(null);
  };

  if (loading) {
    return (
      <div className="programs-container">
        <div className="loading-spinner">Loading programs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="programs-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="programs-container">
      
      {selectedProgram ? (
        <ProgramDetail 
          program={selectedProgram} 
          onClose={handleCloseDetail} 
        />
      ) : (
        <>
          {programStats.length === 0 ? (
            <div className="no-programs">
              No programs found.
            </div>
          ) : (
            <div className="programs-grid">
              {programStats.map((program, index) => (
                <div 
                  key={index} 
                  className="program-card"
                  onClick={() => handleSelectProgram(program)}
                >
                  {program.imageUrl && (
                    <div className="program-image">
                      <img src={program.imageUrl} alt={program.programName} />
                    </div>
                  )}
                  <div className="program-content">
                    <h3>{program.programName}</h3>
                    <p className="program-type">{program.programType}</p>
                    
                    <div className="program-stats">
                      <div className="stat-item">
                        <span className="stat-label">Registrations:</span>
                        <span className="stat-value">{program.totalRegistrations}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Total Attendees:</span>
                        <span className="stat-value">{program.totalAttendees}</span>
                      </div>
                    </div>
                    
                    <button className="view-details-btn">
                      View Participants
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
