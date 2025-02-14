# Uptown Financials Frontend

This is the frontend part of the Uptown Financials project, built using TypeScript and React.

## Project Structure

- **src/**: Contains the source code for the application.
  - **pages/**: Contains the main pages of the application.
    - **Home.tsx**: Home page component.
    - **About.tsx**: About page component.
    - **Services.tsx**: Services page component.
    - **News.tsx**: News page component.
    - **Contact.tsx**: Contact page component.
  - **components/**: Contains reusable components used across the application.
  - **App.tsx**: Main application component that sets up routing.

- **public/**: Contains static assets for the frontend application.

- **package.json**: Configuration file for npm, listing dependencies and scripts.

- **tsconfig.json**: TypeScript configuration file specifying compiler options.

- **Dockerfile**: Instructions to build the Docker image for the frontend application.

## Getting Started

1. **Install Dependencies**: Run `npm install` to install the required dependencies.
2. **Run the Application**: Use `npm start` to start the development server.
3. **Build for Production**: Use `npm run build` to create a production build.

## Pages

- **Home**: The landing page of the application.
- **About**: Information about Uptown Financials.
- **Services**: Details of the services offered.
- **News**: Latest news feeds.
- **Contact**: A form to contact Uptown Financials.

## Docker

To build and run the frontend application using Docker, use the following command:

```bash
docker build -t uptown-financials-frontend .
docker run -p 3000:3000 uptown-financials-frontend
```

This will build the Docker image and run the application on port 3000.