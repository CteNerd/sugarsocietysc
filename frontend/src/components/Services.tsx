// Services.tsx
import React from 'react';
import './Services.css';

const Services: React.FC = () => {
  const services = [
    {
      title: 'Technology',
      subtitle: 'Financial and Operational Process Improvements',
      description: 'Enhance your business operations by getting a technology solution fitted for your business. We will use the correct blend of artificial intelligence tools and accounting principles to design a tailor-made, repeatable process to organize you and your business.',
    },
    {
      title: 'Accounting and Oversight',
      subtitle: 'Detailed and complex accounting made simple',
      description: 'Are you tired of overcomplicated accounting techniques? Is your business in need of practical financial management that empowers you to make informed decisions? Give our accountants a chance to streamline your accounting and oversight practices to focus on the big picture of your business while capturing all of the needed details to operationalize your business.',
    },
    {
      title: 'Tax Planning and Filing',
      subtitle: 'Optimized Tax planning solutions so you always understand your tax position.',
      description: 'Your tax position is a living organism utilized to help maintain the health of your organization. Developments in global tax law are everchanging, and we will keep you prepared to maneuver through the tax terrain. We can plan, file, and submit your individual and/or business tax returns enabling you to achieve your most favorable tax position.',
    },
  ];

  return (
    <section className="services">
      <div className="services-overlay">
        <h2>Uptown Accounting Group Services</h2>
        {services.map((service, index) => (
          <div key={index} className="service">
            <div className="service-column service-column-1">
              <h3>{service.title}</h3>
              <h4>{service.subtitle}</h4>
            </div>
            <div className="service-column service-column-2">
              <p>{service.description}</p>
            </div>
            {index < services.length - 1 && <hr />} {/* Separator Line */}
          </div>
        ))}
      </div>
    </section>
  );
};

export default Services;
