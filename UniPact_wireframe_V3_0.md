# 🛡️ UniPact V3.0 — Wireframes & Data Contracts Specification

> **Document Version**: 3.0  
> **Document Date**: 13 September 2026  
> **Status**: Approved Blueprint for SRS v3.0  
> **Companion Specification**: [UniPact_SRS_v3_0.docx](file:///c:/Users/User/Documents/GitHub/unipact-mvp/UniPact_SRS_v3_0%20(1).docx)

---

## 0. Architectural Foundation & Forward Compatibility with SRS v2.2.1

> [!IMPORTANT]

> **CRITICAL ARCHITECTURAL DIRECTIVE: SRS v2.2.1 is NOT dropped; it is POSTPONED.**

> The institutional student club/guild sponsorship model requires higher university administrative clearance (Student Affairs / HEP authorization, formal club bank accounts, institutional MoUs). While those institutional approvals are pending, UniPact v3.0 activates the **individual-student talent marketplace**.

> 

> **Non-Conflict & Forward Compatibility Rules:**

> 1. **Role Namespace**: Individual talent is registered under `role: "student"`. The `role: "club"` (Club President/Executive) remains cleanly preserved in the authentication schema.

> 2. **Endpoint Isolation**: Individual endpoints (`/api/student/*`) and job endpoints (`/api/jobs/*`) leave club routes (`/api/club/*`) intact for future re-activation.

> 3. **Future Guild Aggregation**: The lightweight `club_affiliation` in Student Profile is stored as a structured field, designed to link directly to official `ClubProfile` and Committee Roster records once university authorization is granted.

> 4. **Dual-Track Marketplace**: When the club track is activated, corporate clients will be presented with two parallel tracks: *Individual Project Work* (Software Dev & Digital Marketing) and *Club Institutional Sponsorship / Hackathons*.


---

## Table of Contents

- [1. The "Split" Registration Landing Page](#1-the-split-registration-landing-page)
- [2. Company Registration Form](#2-company-registration-form)
- [3. Student Registration Form](#3-student-registration-form)
- [4. Universal Login Page](#4-universal-login-page)
- [5. Company Dashboard](#5-company-dashboard)
- [6. Create Job Form](#6-create-job-form)
- [7. Job Management & Match Finalization](#7-job-management-&-match-finalization)
- [8. Company Job Workspace & Deliverables Review](#8-company-job-workspace-&-deliverables-review)
- [9. Student Dashboard](#9-student-dashboard)
- [10. Student Project Workspace & Deliverable Submission](#10-student-project-workspace-&-deliverable-submission)
- [11. Public Student Profile & Verifiable Portfolio](#11-public-student-profile-&-verifiable-portfolio)
- [12. Admin Verification Queue](#12-admin-verification-queue)
- [13. Admin Matchmaking Hub](#13-admin-matchmaking-hub)
- [14. Automated Project Report (PDF Output Specification)](#14-automated-project-report-pdf-output-specification)

---

## 1. The "Split" Registration Landing Page

- **Route Path**: `/register`
- **User Goal**: Identify whether the visitor is a Company seeking vetted university talent or an Individual Student seeking paid project work.
- **Design Strategy**: Present a clean bifurcated decision gateway highlighting core value propositions. Reduces bounce rate and segments users before form display. Explicitly notes the postponed student club track as 'institutional onboarding under university review' to prevent confusion while preserving brand vision.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Logo]                                                                            [ Login ]  |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|                     Empowering Malaysia's Next-Gen University Talent With Paid Work                   |
|                      Specialized Tracks: Software Development & Digital Marketing                    |
|                                                                                                      |
|      +------------------------------------------+  +------------------------------------------+      |
|      |               FOR COMPANIES              |  |         FOR UNIVERSITY STUDENTS          |      |
|      |                                          |  |                                          |      |
|      |             [Icon: Briefcase]            |  |             [Icon: Graduate Hat]         |      |
|      |                                          |  |                                          |      |
|      |  * Hire Vetted University Talent         |  |  * Work on Paid Company Projects         |      |
|      |  * Software Dev & Digital Marketing      |  |  * Build a Verifiable Portfolio          |      |
|      |  * Curated Matching by UniPact Admin     |  |  * Direct Individual Verification        |      |
|      |  * **Free to Join & Post Projects**      |  |  * **Keep Profile Post-Graduation**      |      |
|      |                                          |  |                                          |      |
|      |  [ Register as Company ] ->              |  |  [ Register as Student ] ->              |      |
|      +------------------------------------------+  +------------------------------------------+      |
|                                                                                                      |
|      *Note: Institutional Student Club Guilds are currently under university administration review.  |
|                                                                                                      |
|                                  Already have an account? [ Log In Here ]                            |
+------------------------------------------------------------------------------------------------------+
```

### 1.1 Data Contract (`Navigation Route Contract`)
```json
{
  "route": "/register",
  "methods": "GET (Frontend Client Route)",
  "actions": {
    "on_company_click": "Redirect to /register/company",
    "on_student_click": "Redirect to /register/student",
    "on_login_click": "Redirect to /login"
  }
}
```

---

## 2. Company Registration Form

- **Route Path**: `/register/company`
- **User Goal**: As a Corporate Client, I want to quickly register an account, post projects immediately for free, and submit verification details.
- **Design Strategy**: Implements REQ-3.1.4 and REQ-3.1.5 email domain logic. Corporate domains (@petronas.com, @maxis.com.my) trigger Silent Verification (instant active tier_status='free'). Public free domains (@gmail.com, @yahoo.com) trigger High Risk Enhanced Verification requiring SSM (Suruhanjaya Syarikat Malaysia) document upload.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Logo]                                                           [ <- Back to Selection ]    |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  Create Your Corporate Client Account                                                                |
|  Post jobs for free. Pay a Finder's Fee only when a match is finalized.                              |
|                                                                                                      |
|  Company Name (*)                                                                                    |
|  [ TechVentures Sdn Bhd                                                                           ]  |
|                                                                                                      |
|  Official Work Email (*)                                                                             |
|  [ contact@techventures.com.my                                                                    ]  |
|  (Hint: Use your corporate email for instant Silent Verification. Public emails require SSM upload)  |
|                                                                                                      |
|  Domain Verification Status: [ VERIFIED CORPORATE DOMAIN ] (Auto-Cleared)                            |
|                                                                                                      |
|  SSM Registration Number (*) (e.g., 202301048291)                                                    |
|  [ 202301048291 (1509213-X)                                                                       ]  |
|                                                                                                      |
|  SSM Certificate Document (Required for Public Email Domains / High Risk):                           |
|  +------------------------------------------------------------------------------------------------+  |
|  | [ Drag & Drop SSM Form 9 / Certificate of Incorporation (PDF, JPG, PNG - Max 25MB) ]           |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  Password (*)                                                                                        |
|  [ ********************                                                                           ]  |
|                                                                                                      |
|  Confirm Password (*)                                                                                |
|  [ ********************                                                                           ]  |
|                                                                                                      |
|  [ Register Company Account (Free Tier) ] (Button, Primary)                                          |
|                                                                                                      |
+------------------------------------------------------------------------------------------------------+
```

### 2.1 Data Contract (`POST /api/auth/register/company`)
```json
{
  "endpoint": "POST /api/auth/register/company",
  "content_type": "multipart/form-data",
  "payload": {
    "company_name": "TechVentures Sdn Bhd",
    "email": "contact@techventures.com.my",
    "password": "StrongPassword123!",
    "ssm_number": "202301048291",
    "ssm_document": "(File Object - Required if is_public_domain(email) is True)"
  },
  "response_201": {
    "user_id": 42,
    "email": "contact@techventures.com.my",
    "role": "company",
    "company_profile": {
      "id": 18,
      "company_name": "TechVentures Sdn Bhd",
      "tier_status": "free",
      "verification_status": "verified",
      "is_high_risk": false
    },
    "token": "jwt_access_token"
  },
  "response_400": {
    "email": [
      "A user with that email already exists."
    ],
    "ssm_document": [
      "SSM certificate is mandatory for public email providers."
    ]
  }
}
```

---

## 3. Student Registration Form

- **Route Path**: `/register/student`
- **User Goal**: As an Individual University Student, I want to register my profile directly, verify my student status, and become eligible for paid project matching.
- **Design Strategy**: Implements REQ-3.1.6, REQ-3.1.7, and REQ-3.6.2. Removes club dependency from v2.2.1. Student registers directly. Secondary email enables access post-graduation. Academic email/Student ID verification defaults to 'pending'. Lightweight club affiliation is captured as an optional field, seamlessly preserving forward-compatibility with future club/guild modules.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Logo]                                                           [ <- Back to Selection ]    |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  Join UniPact as Verified Student Talent                                                             |
|  Get matched by Admin to paid company projects in Software Development and Digital Marketing.         |
|                                                                                                      |
|  Full Name (*)                                                                                       |
|  [ Sarah Tan Shu Min                                                                              ]  |
|                                                                                                      |
|  University / Academic Email (*) (Primary)                                                           |
|  [ sarah.tan@siswa.um.edu.my                                                                      ]  |
|  (Allows accelerated verification via verified Malaysian university domains)                         |
|                                                                                                      |
|  Secondary / Personal Email (Optional - Retain access after graduation per REQ-3.1.7)                |
|  [ sarahtan.dev@gmail.com                                                                         ]  |
|                                                                                                      |
|  University / Institution (*)                                                                        |
|  [ Universiti Malaya (UM)                                                                      v  ]  |
|                                                                                                      |
|  Degree / Field of Study (*)                                                                         |
|  [ Bachelor of Computer Science (Software Engineering)                                            ]  |
|                                                                                                      |
|  Primary Domain Focus (*)                                                                            |
|  (X) Software Development     ( ) Digital Marketing     ( ) Both Specialized Tracks                  |
|                                                                                                      |
|  Student Verification Proof (*) (Student ID Card / Proof of Enrolment PDF)                           |
|  +------------------------------------------------------------------------------------------------+  |
|  | [ Drag & Drop Student ID or Letter of Enrolment (PDF, JPG, PNG - Max 25MB) ]                   |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  Club Affiliation (Optional - Lightweight Profile Field per REQ-3.6.2):                              |
|  Club/Society Name: [ UM Computer Science Society                      ]                             |
|  Role/Position:     [ Vice President                                   ]                             |
|                                                                                                      |
|  Password (*)                                                                                        |
|  [ ********************                                                                           ]  |
|                                                                                                      |
|  [ Register as Student Talent ] (Button, Primary)                                                    |
|  Notice: Account defaults to [PENDING VERIFICATION] until verified by UniPact Admin.                 |
+------------------------------------------------------------------------------------------------------+
```

### 3.1 Data Contract (`POST /api/auth/register/student`)
```json
{
  "endpoint": "POST /api/auth/register/student",
  "content_type": "multipart/form-data",
  "payload": {
    "full_name": "Sarah Tan Shu Min",
    "email": "sarah.tan@siswa.um.edu.my",
    "secondary_email": "sarahtan.dev@gmail.com",
    "password": "SecureStudentPass123!",
    "university": "Universiti Malaya",
    "major": "Bachelor of Computer Science",
    "domain_focus": "software_development",
    "verification_doc": "(File Object - Student ID / Enrollment Letter)",
    "club_affiliation_name": "UM Computer Science Society",
    "club_affiliation_role": "Vice President"
  },
  "response_201": {
    "user_id": 88,
    "email": "sarah.tan@siswa.um.edu.my",
    "role": "student",
    "student_profile": {
      "id": 54,
      "full_name": "Sarah Tan Shu Min",
      "university": "Universiti Malaya",
      "verification_status": "pending",
      "verified_badge": false,
      "club_affiliation": {
        "name": "UM Computer Science Society",
        "role": "Vice President"
      }
    },
    "token": "jwt_access_token"
  }
}
```

---

## 4. Universal Login Page

- **Route Path**: `/login`
- **User Goal**: Authenticate any registered user and securely redirect them to their respective role-based command center.
- **Design Strategy**: Single entry portal with clean backend routing. Dynamically evaluates role claims: Company -> /company/dashboard, Student -> /student/dashboard, Admin -> /admin/dashboard. Also reserves dormant routing for future Club role -> /club/dashboard.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Logo]                                                                           [ Home ]    |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|                                     Sign In to UniPact Platform                                      |
|                                                                                                      |
|                                   Email Address                                                      |
|                                   [ user@domain.com                                               ]  |
|                                                                                                      |
|                                   Password                                                           |
|                                   [ ********************                                          ]  |
|                                                                                                      |
|                                   [X] Remember me on this device       [ Forgot Password? ]          |
|                                                                                                      |
|                                   [ Sign In ] (Button, Primary)                                      |
|                                                                                                      |
|                             Don't have an account? [ Create an Account ]                             |
|                                                                                                      |
|  --------------------------------------------------------------------------------------------------  |
|  * Smart Role Redirection Engine:                                                                    |
|    - If role == "company" -> Redirect to /company/dashboard                                          |
|    - If role == "student" -> Redirect to /student/dashboard                                          |
|    - If role == "admin"   -> Redirect to /admin/dashboard                                            |
|    - (If role == "club"   -> Redirect to /club/dashboard [Reserved for postponed v2.2.1 track])      |
+------------------------------------------------------------------------------------------------------+
```

### 4.1 Data Contract (`POST /api/auth/login`)
```json
{
  "endpoint": "POST /api/auth/login",
  "content_type": "application/json",
  "payload": {
    "email": "sarah.tan@siswa.um.edu.my",
    "password": "SecureStudentPass123!"
  },
  "response_200": {
    "user_id": 88,
    "email": "sarah.tan@siswa.um.edu.my",
    "role": "student",
    "redirect_url": "/student/dashboard",
    "token": "jwt_access_token",
    "user_meta": {
      "name": "Sarah Tan Shu Min",
      "verification_status": "verified"
    }
  },
  "response_401": {
    "detail": "No active account found with the given credentials"
  }
}
```

---

## 5. Company Dashboard

- **Route Path**: `/company/dashboard`
- **User Goal**: As a Corporate Client, I want a unified overview of all my posted projects, Admin talent matches awaiting finalization, active project execution, and completed deliverables.
- **Design Strategy**: Displays key metrics, subscription status (Free Tier vs Pro Plan), prominent match-ready action alerts (driving Finder's Fee monetization per REQ-3.2), and direct navigation to post new jobs or review deliverables.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Logo]               Company: [TechVentures Sdn Bhd]   Plan: [Free Tier]       [ Logout ]    |
+------------------------------------------------------------------------------------------------------+
| Navigation: [ **Dashboard** ]  [ My Jobs ]  [ Asset Repository ]  [ Invoices & Billing ]             |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  OVERVIEW METRICS                     SUBSCRIPTION STATUS                                            |
|  +---------------------------------+  +-----------------------------------------------------------+  |
|  | Active Jobs:            [ 3 ]   |  | Tier: Free Tier (RM 100-150 Finder's Fee per match)       |  |
|  | Matches To Finalize:    [ 1 ] ! |  | Pro Plan: RM 499/mo (Unlimited Matches, Zero Finder's Fee)|  |
|  | Completed Projects:     [ 6 ]   |  | [ Upgrade to Pro Tier ] (Button, Secondary)               |  |
|  +---------------------------------+  +-----------------------------------------------------------+  |
|                                                                                                      |
|  ACTION REQUIRED:                                                                                    |
|  +------------------------------------------------------------------------------------------------+  |
|  | ALERT: Admin has matched verified talent for: "Enterprise CRM Pipeline Automation"             |  |
|  | Matched Talent: Sarah Tan (Universiti Malaya) - Verified Talent Rating: 5.0 ★                 |  |
|  | [ Review Match & Finalize -> ] (Button, Primary)                                               |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  ACTIVE JOBS                                                          [ + Post New Job ] (Button)    |
|  +------------------------------------------------------------------------------------------------+  |
|  | Job Title                     | Category       | Status      | Talent Assigned  | Actions      |  |
|  |-------------------------------|----------------|-------------|------------------|--------------|  |
|  | Enterprise CRM Automation     | Software Dev   | MATCHED     | Sarah Tan        | [Finalize]   |  |
|  | TikTok Brand Video Campaign   | Marketing      | IN PROGRESS | Team Apex (2)    | [Workspace]  |  |
|  | Next.js Landing Page Revamp   | Software Dev   | OPEN        | Curating Match...| [Manage]     |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  RECENT COMPLETED PROJECTS & REPORTS                                                                 |
|  +------------------------------------------------------------------------------------------------+  |
|  | HRMS Leave Module Automation (Software Dev)    - Completed 12 Feb 2026   [ Download PDF Report ]|  |
|  | Campus Outreach Reels Series (Digital Mktg)    - Completed 28 Jan 2026   [ Download PDF Report ]|  |
|  +------------------------------------------------------------------------------------------------+  |
+------------------------------------------------------------------------------------------------------+
```

### 5.1 Data Contract (`GET /api/company/dashboard`)
```json
{
  "endpoint": "GET /api/company/dashboard",
  "authentication": "Bearer JWT (Role: company)",
  "response_200": {
    "company_name": "TechVentures Sdn Bhd",
    "tier_status": "free",
    "overview_stats": {
      "active_jobs_count": 3,
      "matches_to_finalize_count": 1,
      "completed_projects_count": 6
    },
    "pending_matches": [
      {
        "job_id": 108,
        "job_title": "Enterprise CRM Pipeline Automation",
        "category": "software_development",
        "matched_talent": {
          "student_id": 54,
          "name": "Sarah Tan Shu Min",
          "university": "Universiti Malaya",
          "rating": 5.0
        }
      }
    ],
    "active_jobs": [
      {
        "job_id": 108,
        "title": "Enterprise CRM Automation",
        "category": "software_development",
        "status": "matched",
        "budget": "3500.00"
      }
    ]
  }
}
```

---

## 6. Create Job Form

- **Route Path**: `/jobs/new`
- **User Goal**: As a Company User, I want to post a new project with precise technical or marketing requirements and upload client raw materials.
- **Design Strategy**: Implements REQ-3.3.1 to REQ-3.3.3. Restricts job creation strictly to two in-scope categories: Software Development and Digital Marketing. Dynamically toggles specific required sub-fields and provides a chunked/resumable raw video uploader for digital marketing footage.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Logo]                                                          [ Cancel / Back to Dashboard ]|
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  Post a New Project Work Order                                                                       |
|  UniPact Admin will curate and match the best-fit verified university talent for this work.          |
|                                                                                                      |
|  Step 1: Select Work Category (*) (Exactly two in-scope domains per REQ-1.2 & REQ-3.3.1)             |
|  (*) Software Development                      ( ) Digital Marketing                                 |
|                                                                                                      |
|  --- [ CATEGORY SPECIFIC FIELDS: SOFTWARE DEVELOPMENT ] -------------------------------------------  |
|  Sub-Type (*): [ CRM / Customer Relationship Management Tool                                      v]  |
|  (Options: Landing Page/Website, ERP, HRMS, CRM, Other Automation Tool)                             |
|                                                                                                      |
|  Required Tech Stack & Skills (*):                                                                   |
|  [ React ] [ Django ] [ PostgreSQL ] [ Docker ] [ + Add Skill Tag ]                                  |
|                                                                                                      |
|  Project Outcome Description (*):                                                                    |
|  [ Build a multi-tenant client pipeline tool with RBAC auth, CSV export, and email alerts.        ]  |
|                                                                                                      |
|  --- [ (IF DIGITAL MARKETING IS SELECTED) ] -------------------------------------------------------  |
|  * Campaign Objective: [ Brand Awareness / User Acquisition                                       ]  |
|  * Target Platforms:   [X] TikTok   [X] Instagram Reels   [ ] YouTube Shorts   [ ] LinkedIn          |
|  * Raw Video Footage Upload Area (Supports resumable chunked video upload per REQ-4.6):              |
|    +----------------------------------------------------------------------------------------------+  |
|    | [ Drag & Drop Raw Client Video Footage (.MP4/.MOV - Resumable S3/Cloud Storage) ]            |  |
|    +----------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  --- [ COMMON PROJECT FIELDS ] --------------------------------------------------------------------  |
|  Job Title (*): [ Enterprise CRM Pipeline Automation                                              ]  |
|                                                                                                      |
|  Job Description (* Markdown):                                                                       |
|  [ We require an experienced student engineer to build our internal CRM lead pipeline...        ]  |
|                                                                                                      |
|  Project Budget (MYR) (*): [ 3500.00     ]       Application/Matching Deadline (*): [ 2026-04-15 ]  |
|                                                                                                      |
|  Required Deliverables Checklist (*):                                                                |
|  1. [ GitHub Repository with Clean Documentation & Dockerfile                            ] [Remove]  |
|  2. [ Live Deployed Staging URL with Seeded Test Accounts                                ] [Remove]  |
|  3. [ Technical Architecture & Handover PDF Report                                       ] [Remove]  |
|  [ + Add Required Deliverable Item ] (Button)                                                        |
|                                                                                                      |
|  Client Asset Repository (Upload project briefs, style guides, brand assets per REQ-3.3.3):          |
|  +------------------------------------------------------------------------------------------------+  |
|  | [ Drag & Drop Briefs, Brand Guidelines, Schemas, Figma Links (.PDF, .ZIP) ]                    |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  [ Save as Draft ]                              [ Publish Job for Matching (Free to Post) ] (Primary)|
+------------------------------------------------------------------------------------------------------+
```

### 6.1 Data Contract (`POST /api/jobs`)
```json
{
  "endpoint": "POST /api/jobs",
  "content_type": "multipart/form-data",
  "payload": {
    "category": "software_development",
    "software_sub_type": "CRM",
    "required_skills": [
      "React",
      "Django",
      "PostgreSQL",
      "Docker"
    ],
    "project_outcome": "Build a multi-tenant client pipeline tool with RBAC auth.",
    "title": "Enterprise CRM Pipeline Automation",
    "description": "We require an experienced student engineer...",
    "budget": "3500.00",
    "closing_date": "2026-04-15T23:59:59Z",
    "deliverable_requirements": [
      "GitHub Repository with Clean Documentation & Dockerfile",
      "Live Deployed Staging URL with Seeded Test Accounts",
      "Technical Architecture & Handover PDF Report"
    ],
    "raw_assets": [
      "(File Objects: briefs, guidelines)"
    ],
    "action": "publish"
  },
  "response_201": {
    "job_id": 108,
    "status": "open",
    "message": "Job published successfully. Queued for Admin curated matching."
  }
}
```

---

## 7. Job Management & Match Finalization

- **Route Path**: `/jobs/{id}/manage`
- **User Goal**: As a Company User, review the talent/team matched by UniPact Admin, inspect their verified credentials, and finalize the contract via the Finder's Fee payment gate.
- **Design Strategy**: Implements REQ-3.2.1 and REQ-3.2.2. Free Tier companies must pay the Finder's Fee (RM 100-150) to unlock contact details and kickoff the project. Pro Tier companies bypass payment with 1-click. Protects marketplace monetization while establishing transparent talent vetting.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Logo]                                                            [ <- Back to My Jobs ]     |
+------------------------------------------------------------------------------------------------------+
| Job #108: Enterprise CRM Pipeline Automation                                                         |
| LIFECYCLE: [Posted: Open] ===> [**MATCHED**] ===> [In Progress] ===> [Completed]                     |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  ADMIN CURATED TALENT MATCH                                                                          |
|  UniPact Admin has evaluated candidate competencies and selected the optimal match:                 |
|                                                                                                      |
|  +------------------------------------------------------------------------------------------------+  |
|  | Matched Talent: Sarah Tan Shu Min                  Badge: [ VERIFIED STUDENT TALENT ]          |  |
|  | University:     Universiti Malaya (UM)             Major: B.Sc. Computer Science (Year 3)      |  |
|  | Track Record:   5.0 ★ Rating (4 Completed Jobs)    Skills: React, Django, PostgreSQL, Docker   |  |
|  | Past Work:      Maxis Youth Portal, Inventory Sync [ View Public Verified Portfolio -> ]      |  |
|  |                                                                                                |  |
|  | Admin Match Notes:                                                                             |  |
|  | "Sarah has direct production experience with Django and React, having completed the Maxis      |  |
|  | portal with stellar client evaluation. Perfect fit for your CRM specifications."               |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  MATCH FINALIZATION & MONETIZATION GATE (Per REQ-3.2.1 & REQ-3.2.2)                                  |
|  +------------------------------------------------------------------------------------------------+  |
|  | Free Tier Account Model:                                                                       |  |
|  | Standard Finder's Fee: RM 150.00                                                               |  |
|  | Finalizing unlocks direct student communication, Discord/Slack workspace, and project start.   |  |
|  |                                                                                                |  |
|  | [ Pay RM 150.00 Finder's Fee & Finalize Match ] (Button, Primary -> Payment Gateway)           |  |
|  |                                                                                                |  |
|  | -- OR --                                                                                       |  |
|  | [ Upgrade to Pro Tier (RM 499/mo) to Finalize Instantly with Zero Finder's Fees ]              |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  (For Pro Plan Clients: [ 1-Click Instant Finalize Match (Pro Plan Active) ] button is displayed)    |
+------------------------------------------------------------------------------------------------------+
```

### 7.1 Data Contract (`POST /api/jobs/{id}/finalize-match`)
```json
{
  "endpoint": "POST /api/jobs/{id}/finalize-match",
  "authentication": "Bearer JWT (Role: company)",
  "payload": {
    "payment_method": "payment_gateway",
    "tier_override": false
  },
  "response_free_tier": {
    "status": "payment_required",
    "finder_fee_amount": 150.0,
    "currency": "MYR",
    "payment_redirect_url": "https://gateway.unipact.my/pay/sess_99214"
  },
  "response_pro_tier": {
    "status": "finalized",
    "job_status": "in_progress",
    "message": "Match finalized under Pro Plan. Asset repository access granted to student.",
    "student_contact": {
      "name": "Sarah Tan Shu Min",
      "email": "sarah.tan@siswa.um.edu.my",
      "phone": "+6012-3456789"
    }
  }
}
```

---

## 8. Company Job Workspace & Deliverables Review

- **Route Path**: `/jobs/{id}/deliverables`
- **User Goal**: As a Company User, monitor project progress, access client assets, review submitted student deliverables, and approve completion.
- **Design Strategy**: Implements REQ-3.3.4, REQ-3.4.4, and REQ-3.5. Provides access-controlled asset repository and deliverables inspection. Approving deliverables triggers the automated ReportLab Project Report PDF generation.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Logo]      Project: Enterprise CRM Automation | Assigned: Sarah Tan    [ Status: IN PROGRESS]|
+------------------------------------------------------------------------------------------------------+
| Tabs: [ Client Asset Repository (3 Files) ]   [ **Student Deliverables (3/3 Submitted)** ]           |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  CLIENT ASSET REPOSITORY (Access Restricted: TechVentures, Sarah Tan, Admin)                         |
|  * CRM_Functional_Spec_v1.pdf (2.4 MB)                           [ Download ]                        |
|  * Corporate_Brand_Kit.zip (18.1 MB)                             [ Download ]                        |
|  * Raw Marketing Footage (For Marketing Projects)                [ Stream / Download ]               |
|  [ + Upload Additional Asset ]                                                                       |
|                                                                                                      |
|  STUDENT SUBMITTED DELIVERABLES (Ready for Review)                                                   |
|  +------------------------------------------------------------------------------------------------+  |
|  | 1. GitHub Code Repository & Documentation                                                      |  |
|  |    URL: https://github.com/unipact-students/techventures-crm                                    |  |
|  |    Status: [ Verified Accessible ] - Commit SHA: 8f9b2a1                                       |  |
|  |                                                                                                |  |
|  | 2. Live Deployed Staging Server                                                                |  |
|  |    URL: https://techventures-crm-staging.vercel.app                                            |  |
|  |    Status: [ Live - SSL Verified ] - Seed Credentials Provided                                 |  |
|  |                                                                                                |  |
|  | 3. Technical Architecture & Handover Documentation                                             |  |
|  |    File: TechVentures_CRM_Architecture_v1.pdf (14.2 MB)                                        |  |
|  |    [ Download PDF Document ]                                                                   |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  STUDENT CONTRIBUTION SUMMARY (Authored by Sarah Tan per REQ-3.5.4):                                 |
|  "Engineered complete multi-tenant pipeline module in Django REST Framework, implemented React      |
|   dashboard with drag-and-drop lead kanban, and configured PostgreSQL database migrations."         |
|                                                                                                      |
|  [ Request Revision / Clarification ]    [ Approve Deliverables & Mark Completed ] (Button, Primary)|
|  *Approving generates official verified Project Report (PDF) and updates student portfolio.          |
+------------------------------------------------------------------------------------------------------+
```

### 8.1 Data Contract (`POST /api/jobs/{id}/complete`)
```json
{
  "endpoint": "POST /api/jobs/{id}/complete",
  "authentication": "Bearer JWT (Role: company)",
  "payload": {
    "approval_status": "approved",
    "rating": 5,
    "company_feedback": "Exceptional execution and clean architecture. Delivered ahead of schedule."
  },
  "response_200": {
    "job_id": 108,
    "status": "completed",
    "report_id": "UP-2026-089",
    "pdf_report_url": "/api/reports/108/download",
    "message": "Project closed. Official PDF report generated and portfolio credential published."
  }
}
```

---

## 9. Student Dashboard

- **Route Path**: `/student/dashboard`
- **User Goal**: As an Individual Student, track my verification status, view projects I have been matched to, enter active workspaces, and monitor my verifiable portfolio.
- **Design Strategy**: Implements REQ-3.1.6 and REQ-3.4. Displays verified talent badge, active project workspace links, match assignments from Admin, and public portfolio share link.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Logo]                 Welcome, Sarah Tan   Badge: [ VERIFIED TALENT ]             [ Logout ]|
+------------------------------------------------------------------------------------------------------+
| Navigation: [ **My Dashboard** ]  [ Active Workspaces ]  [ Public Portfolio ]  [ Settings ]          |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  TALENT STATUS: [ VERIFIED STUDENT TALENT - UNIVERSITI MALAYA ]                                      |
|  Eligible for Admin matching in Software Development & Automation Tools.                             |
|                                                                                                      |
|  PERFORMANCE & EARNINGS METRICS                                                                      |
|  +----------------------------------+----------------------------------+--------------------------+  |
|  | Active Projects:          [ 1 ]  | Completed Projects:        [ 4 ] | Total Earned:  RM 7,200  |  |
|  | Client Satisfaction:      5.0 ★  | Pending Match Offers:      [ 1 ] | Badges: Top Rated 2026   |  |
|  +----------------------------------+----------------------------------+--------------------------+  |
|                                                                                                      |
|  NEW ADMIN MATCH ASSIGNMENT OFFER:                                                                   |
|  +------------------------------------------------------------------------------------------------+  |
|  | Admin has assigned you to: "Next.js E-Commerce Micro-Frontend"                                 |  |
|  | Client: RetailPlus Sdn Bhd | Budget: RM 2,000.00 | Deadline: 21 Days                           |  |
|  | [ Accept Project Assignment ] (Button, Primary)            [ Decline / Pass ]                  |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  ACTIVE PROJECT WORKSPACES                                                                           |
|  +------------------------------------------------------------------------------------------------+  |
|  | Project Title                 | Client           | Category       | Due Date     | Action      |  |
|  |-------------------------------|------------------|----------------|--------------|-------------|  |
|  | Enterprise CRM Automation     | TechVentures     | Software Dev   | 14 Days Left | [Workspace] |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  YOUR PUBLIC VERIFIABLE PORTFOLIO                                                                    |
|  Shareable Link: https://unipact.my/student/sarahtan                       [ Copy Shareable Link ]   |
+------------------------------------------------------------------------------------------------------+
```

### 9.1 Data Contract (`GET /api/student/dashboard`)
```json
{
  "endpoint": "GET /api/student/dashboard",
  "authentication": "Bearer JWT (Role: student)",
  "response_200": {
    "student_name": "Sarah Tan Shu Min",
    "verification_status": "verified",
    "university": "Universiti Malaya",
    "metrics": {
      "active_projects": 1,
      "completed_projects": 4,
      "rating": 5.0,
      "total_earnings": 7200.0
    },
    "active_projects": [
      {
        "job_id": 108,
        "title": "Enterprise CRM Pipeline Automation",
        "company": "TechVentures Sdn Bhd",
        "category": "software_development",
        "days_remaining": 14,
        "status": "in_progress"
      }
    ],
    "public_portfolio_url": "https://unipact.my/student/sarahtan"
  }
}
```

---

## 10. Student Project Workspace & Deliverable Submission

- **Route Path**: `/student/projects/{id}`
- **User Goal**: As an Assigned Student, access client assets, review requirements, upload deliverables, and submit my contribution summary.
- **Design Strategy**: Implements REQ-3.3.4, REQ-3.3.5 (team viewing), REQ-3.4.3, and REQ-3.5.4. Provides secure download of client raw materials and video, supports multi-student team visibility for digital marketing jobs, and captures the student's individual contribution statement feeding the report engine.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Logo]                                                            [ <- Back to Dashboard ]   |
+------------------------------------------------------------------------------------------------------+
| Workspace: Enterprise CRM Pipeline Automation | Client: TechVentures Sdn Bhd | Budget: RM 3,500.00   |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  CLIENT ASSET REPOSITORY (Access Granted by Client per REQ-3.3.4)                                    |
|  * CRM_Requirements_v1.pdf (2.4 MB)                                  [ Download File ]              |
|  * Brand_Guidelines_2026.pdf (4.1 MB)                                [ Download File ]              |
|  * (For Digital Marketing: Raw Video Footage Streams via S3 player)   [ Stream / Download Raw MP4 ]  |
|                                                                                                      |
|  ASSIGNED PROJECT TEAM (Per REQ-3.3.5 for multi-student assignments):                                 |
|  * Sarah Tan Shu Min (Lead Full-Stack Developer - Universiti Malaya)                                 |
|  * Ahmad Razak (UI/Frontend Contributor - Universiti Malaya)                                         |
|                                                                                                      |
|  SUBMIT REQUIRED DELIVERABLES (Per REQ-3.4.3):                                                       |
|  +------------------------------------------------------------------------------------------------+  |
|  | Deliverable 1: GitHub Code Repository Link (*)                                                 |  |
|  | [ https://github.com/unipact-students/techventures-crm                                      ]  |  |
|  |                                                                                                |  |
|  | Deliverable 2: Live Deployed Staging URL (*)                                                   |  |
|  | [ https://techventures-crm-staging.vercel.app                                                ]  |  |
|  |                                                                                                |  |
|  | Deliverable 3: Architecture & Handover Documentation (PDF / ZIP) (*)                           |  |
|  | +--------------------------------------------------------------------------------------------+  |  |
|  | | TechVentures_CRM_Architecture_v1.pdf (14.2 MB) - [ File Attached ]                         |  |  |
|  | +--------------------------------------------------------------------------------------------+  |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  INDIVIDUAL CONTRIBUTION SUMMARY (Feeds directly into Project Report & Portfolio per REQ-3.5.4):    |
|  Your Specific Role: [ Lead Full-Stack Architect & Backend Engineer                            ]  |
|  Key Skills Applied: [ Django REST Framework, PostgreSQL, Docker, React, RBAC Security         ]  |
|  Outcome Statement:                                                                                  |
|  [ Designed schema, implemented REST APIs with JWT, and configured CI/CD pipeline deployment...  ]  |
|                                                                                                      |
|  [ Submit Deliverables & Mark Job Ready for Client Approval ] (Button, Primary)                      |
+------------------------------------------------------------------------------------------------------+
```

### 10.1 Data Contract (`POST /api/student/projects/{id}/deliverables`)
```json
{
  "endpoint": "POST /api/student/projects/{id}/deliverables",
  "authentication": "Bearer JWT (Role: student)",
  "content_type": "multipart/form-data",
  "payload": {
    "deliverable_links": [
      {
        "name": "GitHub Repo",
        "url": "https://github.com/unipact-students/techventures-crm"
      },
      {
        "name": "Staging URL",
        "url": "https://techventures-crm-staging.vercel.app"
      }
    ],
    "deliverable_files": [
      "(File Object: Architecture Documentation PDF)"
    ],
    "contribution_role": "Lead Full-Stack Architect",
    "contribution_skills": [
      "Django",
      "PostgreSQL",
      "React",
      "Docker"
    ],
    "contribution_summary": "Designed schema, implemented REST APIs with JWT, and configured deployment."
  },
  "response_200": {
    "status": "submitted",
    "message": "Deliverables successfully submitted. Client notified for final inspection."
  }
}
```

---

## 11. Public Student Profile & Verifiable Portfolio

- **Route Path**: `/student/{username}`
- **User Goal**: As a Student, provide a public credential link to recruiters proving real-world experience verified by corporate clients and UniPact.
- **Design Strategy**: Implements REQ-3.6.1 and REQ-3.6.2. Central public showcase. Displays verified student badge, academic institution, optional lightweight club affiliation, skills taxonomy, and immutable project cards backed by official Project Reports.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Logo]                                                          [ Share Portfolio Link ]     |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|      [ Avatar Photo ]      Sarah Tan Shu Min                                                         |
|                            Universiti Malaya — B.Sc. Computer Science (Year 3)                       |
|                            Badge: [ ✓ VERIFIED STUDENT TALENT ]                                      |
|                            Club Affiliation: Vice President, UM Computer Science Society             |
|                            Overall Rating: 5.0 ★★★★★ (4 Verified Client Projects Completed)         |
|                                                                                                      |
|  TECHNICAL SKILLS & COMPETENCIES:                                                                    |
|  [ Python ]  [ Django ]  [ React ]  [ PostgreSQL ]  [ Next.js ]  [ Docker ]  [ TailwindCSS ]         |
|                                                                                                      |
|  VERIFIED PROJECT PORTFOLIO (Backed by Official UniPact Project Reports per REQ-3.6.1)               |
|  +------------------------------------------------------------------------------------------------+  |
|  | Enterprise CRM Pipeline Automation                                                             |  |
|  | Client: TechVentures Sdn Bhd                   Category: Software Development (CRM Tool)       |  |
|  | Role: Lead Full-Stack Architect                Timeline: Completed April 2026                  |  |
|  | Outcome: Built multi-tenant pipeline tool handling 10k+ customer contacts with sub-second queries.|  |
|  | [ View Verified Project Report (PDF) #UP-2026-089 ]                                            |  |
|  +------------------------------------------------------------------------------------------------+  |
|  | Maxis Youth Portal Dynamic Sub-System                                                          |  |
|  | Client: Maxis Berhad                           Category: Software Development (Landing Page)   |  |
|  | Role: Frontend Lead                            Timeline: Completed December 2025               |  |
|  | Outcome: Delivered mobile-responsive promotional portal generating 45,000 unique student hits.|  |
|  | [ View Verified Project Report (PDF) #UP-2025-142 ]                                            |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  Verified by UniPact Digital Credential Engine — Immutable Student Portfolio Record                  |
+------------------------------------------------------------------------------------------------------+
```

### 11.1 Data Contract (`GET /api/student/{username}/portfolio`)
```json
{
  "endpoint": "GET /api/student/{username}/portfolio",
  "authentication": "Public (No auth required)",
  "response_200": {
    "username": "sarahtan",
    "full_name": "Sarah Tan Shu Min",
    "university": "Universiti Malaya",
    "major": "B.Sc. Computer Science",
    "is_verified": true,
    "club_affiliation": {
      "name": "UM Computer Science Society",
      "role": "Vice President"
    },
    "skills": [
      "Python",
      "Django",
      "React",
      "PostgreSQL",
      "Next.js",
      "Docker"
    ],
    "projects": [
      {
        "report_id": "UP-2026-089",
        "title": "Enterprise CRM Pipeline Automation",
        "client_name": "TechVentures Sdn Bhd",
        "category": "software_development",
        "role": "Lead Full-Stack Architect",
        "outcome": "Built multi-tenant pipeline tool handling 10k+ customer contacts.",
        "completed_date": "2026-04-15",
        "report_pdf_url": "https://unipact.my/reports/UP-2026-089.pdf"
      }
    ]
  }
}
```

---

## 12. Admin Verification Queue

- **Route Path**: `/admin/verifications`
- **User Goal**: As UniPact Admin, inspect and verify high-risk company SSM certificates and student university credentials.
- **Design Strategy**: Implements REQ-3.1.5 and REQ-3.1.6. Replaces old club verification queue from v2.2.1. Displays two operational queues: Student Enrollment Proofs and High-Risk Company SSMs. Automated email alerts trigger on approval or rejection.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Admin Console]                                                        [ High Council Admin ]|
+------------------------------------------------------------------------------------------------------+
| Navigation: [ **Verifications** ]  [ Matchmaking Hub ]  [ All Jobs ]  [ System Logs ]  [ Settings ]  |
+------------------------------------------------------------------------------------------------------+
| Tabs: [ **Student Verifications (12 Pending)** ]       [ Company SSM Documents (3 Pending) ]         |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  PENDING STUDENT VERIFICATION ITEM (1 of 12)                                                         |
|  +------------------------------------------------------------------------------------------------+  |
|  | Applicant: Muhammad Alif bin Azman               Email: alif@siswa.ukm.edu.my                  |  |
|  | University: Universiti Kebangsaan Malaysia (UKM) Major: Digital Media & Communications (Yr 2)   |  |
|  | Domain Focus: Digital Marketing                  Domain Check: [ Validated Edu Domain ]        |  |
|  |                                                                                                |  |
|  | Uploaded Student Proof Document:                                                              |  |
|  | File: ukm_matric_card_alif.jpg (1.8 MB)                                                        |  |
|  | [ Preview Document in Modal ]               [ Download Original Proof ]                        |  |
|  |                                                                                                |  |
|  | Decision Actions:                                                                              |  |
|  | [ Approve & Grant Verified Badge ] (Primary)     [ Reject with Reason... ] (Danger)            |  |
|  +------------------------------------------------------------------------------------------------+  |
|                                                                                                      |
|  --- [ IF COMPANY SSM TAB IS SELECTED ] -----------------------------------------------------------  |
|  +------------------------------------------------------------------------------------------------+  |
|  | Company: Apex Global Trading                     Domain: apex.ops@gmail.com [ HIGH RISK ]      |  |
|  | SSM Reg: 202401099214                            Uploaded Document: SSM_Form_9.pdf (3.1 MB)    |  |
|  | [ Approve Company SSM -> Unblocks Posting ]      [ Reject SSM -> Flags Account ]               |  |
|  +------------------------------------------------------------------------------------------------+  |
+------------------------------------------------------------------------------------------------------+
```

### 12.1 Data Contract (`POST /api/admin/verifications/{type}/{id}/review`)
```json
{
  "endpoint": "POST /api/admin/verifications/{type}/{id}/review",
  "authentication": "Bearer JWT (Role: admin)",
  "payload": {
    "action": "approve",
    "rejection_reason": ""
  },
  "response_200": {
    "status": "success",
    "entity_type": "student",
    "entity_id": 88,
    "verification_status": "verified",
    "message": "Student verified. Notification email sent to applicant."
  }
}
```

---

## 13. Admin Matchmaking Hub

- **Route Path**: `/admin/matchmaking`
- **User Goal**: As UniPact Admin, review open company jobs and curate/assign the best-fit verified student or small student team.
- **Design Strategy**: Implements REQ-3.4.1 (Admin Matching). Replaces the old open club application queue from v2.2.1. Admin inspects the open job requirements (software stack or marketing KPIs) and queries the verified talent pool to assign individual talent or a team. Assigning updates the job to 'matched' and prompts the company.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| UniPact [Admin Console]                                                        [ Curated Matchmaker ]|
+------------------------------------------------------------------------------------------------------+
| Navigation: [ Verifications ]  [ **Matchmaking Hub** ]  [ All Jobs ]  [ System Logs ]                |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  STEP 1: SELECT OPEN JOB AWAITING MATCH            STEP 2: MATCHMAKING INSPECTOR & TALENT POOL       |
|  +-----------------------------------------------+ +-----------------------------------------------+ |
|  | Filter: [ All Categories                    v]| | Job #108: Enterprise CRM Pipeline Automation   | |
|  |                                               | | Client: TechVentures Sdn Bhd | Budget: RM 3,500 | |
|  | [X] Job #108: Enterprise CRM Automation       | | Sub-Type: CRM Tool | Required: React, Django    | |
|  |     Category: Software Dev | Budget: RM 3,500 | | Client Brief: CRM_Requirements_v1.pdf [View]   | |
|  |                                               | |-----------------------------------------------| |
|  | [ ] Job #109: TikTok Viral Brand Series       | | SEARCH VERIFIED TALENT POOL:                  | |
|  |     Category: Marketing | Budget: RM 1,800    | | [ Search by skills, uni, keyword...        ] | |
|  |                                               | |                                               | |
|  | [ ] Job #110: HRMS Attendance Portal          | | RECOMMENDED TALENT MATCHES:                   | |
|  |     Category: Software Dev | Budget: RM 4,000 | | 1. Sarah Tan (Universiti Malaya)              | |
|  |                                               | |    Rating: 5.0 ★ (4 Completed Jobs)           | |
|  |                                               | |    Skills: React, Django, PostgreSQL, Docker  | |
|  |                                               | |    [X] Select as Primary Assignee             | |
|  |                                               | |                                               | |
|  |                                               | | 2. Kevin Lee (Universiti Sains Malaysia)      | |
|  |                                               | |    Rating: 4.8 ★ (2 Completed Jobs)           | |
|  |                                               | |    Skills: Django, Vue.js, PostgreSQL         | |
|  |                                               | |    [ ] Select Contributor                     | |
|  |                                               | |                                               | |
|  |                                               | | [ ] Enable Team Assignment (Per REQ-3.3.5)    | |
|  |                                               | |                                               | |
|  |                                               | | Matchmaker Rationale Note (Sent to Client):   | |
|  |                                               | | [ Sarah has proven production experience... ] | |
|  |                                               | |                                               | |
|  |                                               | | [ Assign Talent & Propose Match ] (Button)    | |
|  +-----------------------------------------------+ +-----------------------------------------------+ |
+------------------------------------------------------------------------------------------------------+
```

### 13.1 Data Contract (`POST /api/admin/matchmaking/assign`)
```json
{
  "endpoint": "POST /api/admin/matchmaking/assign",
  "authentication": "Bearer JWT (Role: admin)",
  "payload": {
    "job_id": 108,
    "assigned_student_ids": [
      54
    ],
    "match_notes": "Sarah has proven production experience building Django and React dashboards."
  },
  "response_200": {
    "job_id": 108,
    "status": "matched",
    "assigned_students": [
      {
        "id": 54,
        "name": "Sarah Tan Shu Min",
        "role": "Primary Assignee"
      }
    ],
    "message": "Talent assigned. Job status updated to matched. Client notified for finalization."
  }
}
```

---

## 14. Automated Project Report (PDF Output Specification)

- **Route Path**: `/reports/{job_id}/pdf`
- **User Goal**: Provide an immutable, cryptographically verifiable PDF project completion summary for the Company and Student portfolio.
- **Design Strategy**: Implements REQ-3.5.1 to REQ-3.5.4 using ReportLab. Automatically compiles project metadata, client verification, assigned talent contributions, and deliverable verification hashes upon job completion. Features a verification QR code for public authenticity checks.

### Wireframe Layout (Monospace ASCII)
```
+------------------------------------------------------------------------------------------------------+
| [ UniPact Official Seal ]          OFFICIAL PROJECT REPORT & CREDENTIAL               ID: #UP-2026-089|
+------------------------------------------------------------------------------------------------------+
| Issue Date: 15 April 2026          Platform Authority: UniPact Systems Malaysia                     |
+------------------------------------------------------------------------------------------------------+
|                                                                                                      |
|  1. PROJECT EXECUTIVE SUMMARY                                                                        |
|  * Project Title:       Enterprise CRM Pipeline Automation                                            |
|  * Work Category:       Software Development (Sub-Type: CRM Automation Tool)                          |
|  * Corporate Client:    TechVentures Sdn Bhd (SSM Reg: 202301048291)                                  |
|  * Total Budget:        RM 3,500.00 (Finder's Fee Paid / Escrow Reconciled)                           |
|  * Execution Timeline:  Posted: 01/04/2026 | Matched: 03/04/2026 | Completed: 15/04/2026             |
|                                                                                                      |
|  2. ASSIGNED TALENT & CONTRIBUTION SUMMARY (Feeds Student Portfolio per REQ-3.5.4)                   |
|  * Student Engineer:    Sarah Tan Shu Min (Universiti Malaya - B.Sc. Computer Science)               |
|  * Talent ID / Badge:   #VT-9921 [ VERIFIED TALENT ]                                                 |
|  * Project Role:        Lead Full-Stack Architect & Backend Engineer                                 |
|  * Technical Stack:     Django REST Framework, React, PostgreSQL, Docker, TailwindCSS                |
|  * Work Output Summary: Designed relational database models, created secured JWT endpoints, and     |
|                         engineered React dashboard with automated CI/CD deployment pipeline.         |
|  * Client Rating:       5.0 / 5.0 ★★★★★ ("Exceptional execution and clean architecture.")            |
|                                                                                                      |
|  3. DELIVERABLE VERIFICATION MANIFEST                                                                |
|  * Artifact 1: GitHub Repository: https://github.com/unipact-students/techventures-crm (SHA: 8f9b2a1) |
|  * Artifact 2: Staging Server URL: https://techventures-crm-staging.vercel.app (SSL Verified)        |
|  * Artifact 3: Handover Document: TechVentures_CRM_Architecture_v1.pdf (SHA-256 Checksum: c8e3f4...) |
|                                                                                                      |
|  +--------------------------------------------------+  +------------------------------------------+  |
|  | Cryptographically Signed by UniPact Engine       |  | [ QR Code: Verify Online Authenticity ]  |  |
|  | Public Verification URL:                         |  | Scan with mobile camera to verify this   |  |
|  | https://unipact.my/verify/UP-2026-089            |  | student credential on UniPact registry   |  |
|  +--------------------------------------------------+  +------------------------------------------+  |
+------------------------------------------------------------------------------------------------------+
```

### 14.1 Data Contract (`GET /api/reports/{job_id}/download`)
```json
{
  "endpoint": "GET /api/reports/{job_id}/download",
  "authentication": "Bearer JWT (Company owner, Assigned Student, Admin)",
  "response_headers": {
    "Content-Type": "application/pdf",
    "Content-Disposition": "attachment; filename=\"UniPact_Report_UP-2026-089.pdf\""
  },
  "response_body": "Binary PDF stream generated by ReportLab engine"
}
```

---
