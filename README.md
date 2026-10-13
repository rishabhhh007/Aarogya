# Aarogya — Hospital Management System

Aarogya is a full-stack hospital management system designed to bring essential hospital operations into one place. It provides a centralized interface for managing patients, hospital staff, appointments, billing, clinical information, and other day-to-day administrative tasks.

The project follows a role-based approach, so users can work with the information and operations relevant to their responsibilities. It also includes an AI-powered hospital assistant built with the Google Gemini API to make it easier for authorized users to retrieve relevant information from the system.

The goal of Aarogya is to explore how a modern web application can simplify hospital workflows through structured data management, role-based access, and AI-assisted information retrieval.

**Live Demo:** [https://aarogya-sage.vercel.app/](https://aarogya-sage.vercel.app/)

**Source Code:** [https://github.com/rishabhhh007/Aarogya](https://github.com/rishabhhh007/Aarogya)

---

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Application Architecture](#application-architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Database Setup](#database-setup)
- [API Overview](#api-overview)
- [AI-Powered Hospital Assistant](#ai-powered-hospital-assistant)
- [Deployment](#deployment)
- [Security Considerations](#security-considerations)
- [Future Improvements](#future-improvements)
- [Contributing](#contributing)
- [Author](#author)



### Project Objectives

- Build a full-stack application using the MERN stack.
- Organize hospital workflows into dedicated modules.
- Implement authentication and role-based access control.
- Connect a React frontend to a RESTful backend.
- Store and manage structured hospital data using MongoDB.
- Integrate Google Gemini for AI-assisted information retrieval.
- Deploy the frontend and backend using Vercel.

## Features

### 1. Role-Based Access Control

Aarogya is designed around the different responsibilities of users working within a hospital.

- Authentication for accessing protected application functionality.
- Backend authorization for protected API operations.
- AI assistant tools restricted according to the authenticated user's permissions.

### 2. Patient Management

The patient module provides a dedicated area for working with patient information.

- Centralized patient record management.
- Access to patient-related information through the application.
- Integration with other supported hospital workflows.

### 3. Staff Management

The staff module supports hospital workforce administration.

- Centralized staff information.
- Staff-related operational management.

### 4. Appointment Management

The appointment module provides functionality for managing hospital appointment information.

- Access to appointment records.
- A dedicated API for appointment-related operations.

### 5. Billing Management

The billing module handles billing-related information within the application.

- Dedicated billing API endpoints.
- Organized access to billing records.

### 6. Hospital Infrastructure

The infrastructure module provides a dedicated area for hospital infrastructure-related information.

- Centralized infrastructure management.
- A separate backend route for infrastructure operations.

### 7. Clinical and Operational Modules

The backend includes additional modules for supporting hospital workflows:

- **Vitals:** patient vital information.
- **Laboratory:** lab-related records and information.
- **Duties:** staff duty and scheduling-related operations.
- **Reports:** reporting-related functionality.
- **Dashboard:** an API for dashboard information and summaries.

### 8. AI-Powered Hospital Assistant

Aarogya includes an AI assistant powered by Google's Gemini API.

- Conversational interaction through a dedicated backend endpoint.
- Context-aware responses based on the authenticated user's role.
- Tool-based retrieval of supported application data.
- Restrictions on which tools can be called by different roles.
- Request throttling to help control excessive usage.
- Error handling for unavailable AI services, invalid API keys, and quota limits.

The assistant is intended to support information retrieval, not replace clinical judgment or independently make medical decisions.

---

## Technology Stack

| Technology            | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| React                 | Building the user interface                      |
| Vite                  | Frontend development server and production build |
| React Router          | Client-side navigation                           |
| Axios                 | HTTP communication with the backend              |
| Recharts              | Data visualization and charts                    |
| Node.js               | JavaScript runtime for the backend               |
| Express.js            | REST API and request handling                    |
| MongoDB               | Application database                             |
| Mongoose              | MongoDB data modeling and database access        |
| JSON Web Tokens (JWT) | Authentication and protected requests            |
| bcryptjs              | Password hashing utilities                       |
| Google Gemini API     | AI-assisted information retrieval                |
| Vercel                | Deployment and application hosting               |
| Git and GitHub        | Version control and source code management       |

The frontend(client) and backend(server) are maintained in separate directories, allowing each application to be installed, developed, and built independently.

---

## Application Architecture

Aarogya uses a client-server architecture.

```text
                    User
                      |
                      v
             React Web Application
               (Vite + React)
                      |
                 HTTP Requests
                      |
                      v
              Express REST API
                      |
           Authentication & RBAC
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
      MongoDB      API Modules   Gemini API
                   Patients     AI Assistant
                   Staff
                   Appointments
                   Billing
                   Reports
                   Vitals
                   Labs
                   Duties
                   Infrastructure
```

### How It Works

1. A user interacts with the React frontend.
2. The frontend sends HTTP requests to the Express backend.
3. The backend authenticates requests and checks permissions for protected operations.
4. Mongoose communicates with MongoDB to retrieve or update application data.
5. The backend returns an appropriate response to the frontend.
6. When the AI assistant is used, the backend communicates with Gemini and handles supported tool calls under the authenticated user's permissions.

Keeping database operations and authorization on the backend helps separate presentation logic from application rules.

---

## Project Structure

The repository is organized as follows:

```text
Aarogya/
│
├── client/
│   ├── public/                  # Public frontend assets
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Application pages
│   │   ├── context/             # Shared application state
│   │   ├── config/              # Frontend configuration
│   │   └── styles/              # Styling resources
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── middleware/              # Authentication middleware
│   ├── routes/                  # REST API routes
│   ├── schema/                  # Data schemas
│   ├── ai/                      # AI assistant tools
│   ├── server.js                # Express application entry point
│   ├── seed.js                  # Database seeding
│   ├── seedBills.js              # Billing demo data
│   ├── seedCare.js               # Additional demo data
│   ├── seedAll.js                # Combined seeding script
│   ├── clearData.js              # Data clearing utility
│   └── package.json
│
├── vercel.json                  # Deployment configuration
├── .gitignore
└── README.md
```

This tree is intended as a guide to the main application areas; check the repository for the complete and current list of files.

---

## Environment Variables

The backend reads configuration from environment variables so that credentials and deployment settings do not need to be hardcoded.

Create `server/.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
CLIENT_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

### Variable Reference

| Variable         | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `PORT`           | Local backend port; defaults to `5000`.                    |
| `MONGO_URI`      | MongoDB connection string.                                 |
| `CLIENT_ORIGIN`  | Frontend origin allowed by the Express CORS configuration. |
| `GEMINI_API_KEY` | API key used by the Google Gemini integration.             |
| `GEMINI_MODEL`   | Gemini model identifier; defaults to `gemini-2.5-flash`.   |

The values above reflect the backend configuration. If the frontend uses an environment variable for its API base URL, configure that variable according to the actual client configuration file and your deployment setup.

**Important:** Never commit your actual `.env` file, database credentials, or API keys to GitHub. Use placeholders in example files.

---

## Running the Application

Start the backend and frontend in separate terminals.

### Start the Backend

```bash
cd server
npm run server
```

The Express server uses port `5000` by default, unless a different `PORT` is configured.

### Start the Frontend

```bash
cd client
npm run dev
```

Vite normally starts the frontend at:

[http://localhost:5173/](http://localhost:5173/)

Open the local URL displayed in the terminal.

### Build the Frontend for Production

```bash
cd client
npm run build
```

Vite generates the production build in the `client/dist` directory.

---

## Database Setup

Aarogya uses MongoDB for persistent application data. The backend reads the connection string from `MONGO_URI` and uses Mongoose to connect to the database.

### Using MongoDB Atlas

1. Create a cluster in MongoDB Atlas.
2. Create a database user with an appropriate password.
3. Configure the network access rules for your development or deployment environment.
4. Obtain the MongoDB connection string.
5. Add the connection string to `server/.env` as `MONGO_URI`.
6. Restart the backend and check that the database connection succeeds.

The connection string should be kept private.

### Database Seeding

The backend includes scripts for creating or preparing demo data.

From the `server` directory, the available commands are:

```bash
npm run seed
npm run demobills
npm run democare
npm run seedall
```

Use the appropriate script for your development setup. Review the scripts before running them against an existing database, particularly if it contains data you need to preserve.

The project also provides a `clear` command. **Do not run `npm run clear` against a database containing important data without first reviewing what the script deletes.**

---

## API Overview

The Express backend exposes separate route groups for different application modules.

| Base route          | Responsibility            |
| ------------------- | ------------------------- |
| `/api/auth`         | Authentication            |
| `/api/dashboard`    | Dashboard information     |
| `/api/patients`     | Patient management        |
| `/api/staff`        | Staff management          |
| `/api/infra`        | Hospital infrastructure   |
| `/api/appointments` | Appointment management    |
| `/api/billing`      | Billing operations        |
| `/api/reports`      | Reports                   |
| `/api/vitals`       | Patient vital information |
| `/api/labs`         | Laboratory information    |
| `/api/duties`       | Staff duty operations     |
| `/api/chat`         | AI assistant              |

These are the API base paths. The specific HTTP methods, request bodies, response formats, and permissions are defined by the individual route handlers.

### Authentication and Protected Routes

Protected endpoints use backend authentication middleware. The application also applies role-aware restrictions to AI tool calls.

When extending the API, authorization should be checked on the server for every sensitive operation. Frontend navigation restrictions alone are not sufficient to protect hospital records.

---

## AI-Powered Hospital Assistant

The AI integration uses the Google GenAI SDK on the backend.

The assistant accepts a conversation through the `/api/chat` endpoint and can request supported tools to retrieve application information. The backend checks whether a requested tool is permitted for the authenticated user's role before executing it.

### Request Flow

1. An authenticated user submits a question.
2. The backend prepares the conversation context.
3. Gemini generates a response or requests a supported tool.
4. The backend checks permissions and executes allowed tool calls.
5. Retrieved information is returned to Gemini for response generation.
6. The assistant returns a response to the frontend.

The implementation also includes a per-user request limit and handling for common API errors, including quota exhaustion and invalid configuration.

The assistant is intended to support administrative and information-retrieval workflows. It should not be treated as a substitute for a qualified healthcare professional.

To enable this feature locally, configure `GEMINI_API_KEY` in `server/.env`. If the key is missing, the assistant endpoint reports that the service is not configured.

---

## Deployment

The repository includes a `vercel.json` file configured for the Vite frontend and Express backend.

Live application:

**[https://aarogya-sage.vercel.app/](https://aarogya-sage.vercel.app/)**

### Deployment Configuration

The Vercel configuration defines separate services for:

- **Client:** the frontend located in `client/`.
- **Server:** the Express application located in `server/`.

It also routes `/api/*` requests to the backend service and sends other application paths to the frontend.

### Environment Variables in Production

Configure the required variables in the relevant Vercel project or service settings:

- `MONGO_URI`
- `CLIENT_ORIGIN`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`, if you want to override the default model.
- `PORT`, if required by the selected hosting environment.

Make sure `CLIENT_ORIGIN` matches the deployed frontend origin. Also ensure the frontend sends API requests to the deployed backend through the routing configuration or the appropriate API base URL.

After changing code, commit and push the changes to the connected GitHub branch to trigger a deployment if automatic deployments are enabled. Check the Vercel deployment logs if the updated application does not appear as expected.

---

## Contributing

Contributions and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes and test them locally.
4. Commit your changes with a clear message.
5. Open a pull request describing what changed and why.

For larger changes, it is helpful to discuss the proposed approach before implementation.

---

## Author

**Rishabh Kumar**

- GitHub: [@rishabhhh007](https://github.com/rishabhhh007)
- Project Repository: [Aarogya](https://github.com/rishabhhh007/Aarogya)
- Live Demo: [Aarogya on Vercel](https://aarogya-sage.vercel.app/)

---

*Built as a full-stack project to explore hospital workflow management, role-based authorization, REST API development, database integration, and AI-assisted information retrieval.*
