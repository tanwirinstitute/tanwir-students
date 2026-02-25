import React from 'react';
import { ProgramStats } from '../../services/programs/programService';
import '../../styles/programs.css';

interface ProgramDetailProps {
  program: ProgramStats;
  onClose: () => void;
}

export const ProgramDetail: React.FC<ProgramDetailProps> = ({ program, onClose }) => {
  return (
    <div className="program-detail">
      <div className="detail-header">
        <button className="back-button" onClick={onClose}>
          Back to Programs
        </button>
      </div>

      <div className="program-info">
        {program.imageUrl && (
          <div className="program-detail-image">
            <img src={program.imageUrl} alt={program.programName} />
          </div>
        )}
        
        <h2>{program.programName}</h2>
        <p className="program-type-detail">{program.programType}</p>
        
        <div className="stats-summary">
          <div className="summary-card">
            <span className="material-icons">people</span>
            <div>
              <h3>{program.totalRegistrations}</h3>
              <p>Total Registrations</p>
            </div>
          </div>
          <div className="summary-card">
            <span className="material-icons">groups</span>
            <div>
              <h3>{program.totalAttendees}</h3>
              <p>Total Attendees</p>
            </div>
          </div>
        </div>
      </div>

      <div className="participants-section">
        <h3>Participants</h3>
        <div className="table-scroll-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Attendees</th>
              </tr>
            </thead>
            <tbody>
              {program.participants.map((participant, index) => (
                <tr key={index}>
                  <td>{participant.firstName} {participant.lastName}</td>
                  <td>{participant.email}</td>
                  <td>{participant.phone}</td>
                  <td className="attendee-count">{participant.attendeeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
