import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PreSaleEventSummary } from '@sugarsocietysc/shared';
import { listPublicPreSaleEvents } from '../../api/catalog-client';
import LoadingSpinner from '../../components/LoadingSpinner';
import './presale.css';

export default function PreSale() {
  const [events, setEvents] = useState<PreSaleEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPublicPreSaleEvents()
      .then(setEvents)
      .catch(() => setError('Unable to load Pre-Sale events right now. Please try again shortly.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <div className="presale-page">
        <h1>Pre-Sales</h1>
        <p className="presale-error" role="alert">{error}</p>
      </div>
    );
  }

  return (
    <div className="presale-page">
      <div className="presale-header">
        <h1>Pre-Sales</h1>
        <p>Choose a seasonal menu and reserve your treats for pickup.</p>
      </div>
      {events.length === 0 ? (
        <div className="presale-step">
          <h2>No Pre-Sales Are Available Right Now</h2>
          <p>Check back soon&mdash;follow us on social media for the next announcement!</p>
        </div>
      ) : (
        <div className="presale-event-grid">
          {events.map((event) => (
            <article className="presale-event-card" key={event.id}>
              <p className="presale-event-status">{event.status === 'open' ? 'Ordering open' : 'Coming soon'}</p>
              <h2>{event.name}</h2>
              <p>Pickup: {new Date(event.pickupDate).toLocaleDateString()}</p>
              {event.status === 'open' ? (
                <>
                  <p>Order by {new Date(event.orderWindowEnd).toLocaleDateString()}</p>
                  <Link className="presale-primary-button" to={`/presale/${event.id}`}>Order now</Link>
                </>
              ) : (
                <p>Orders open {new Date(event.orderWindowStart).toLocaleDateString()}.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
