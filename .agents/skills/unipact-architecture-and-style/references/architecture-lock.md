# Reference: Architecture Lock Specification

## 1. Dual-Track Model Mapping

| Architectural Layer | V3.0 (Individual Student Marketplace) | V2.2.1 (Club & Guild Sponsorships) |
| :--- | :--- | :--- |
| **User Role** | `User.Role.STUDENT` (`'STUDENT'`) | `User.Role.CLUB` (`'CLUB'`) |
| **Profile Model** | `StudentProfile` (`users.models`) | `ClubProfile` (`users.models`) |
| **Entity Identifier** | Student Matric ID & Full Name | Club Name & University |
| **Relationship Field** | `StudentProfile.club_affiliation` (str) | `ClubMember` & `ShadowUser` |
| **Campaign Model** | `Campaign.Type` = `SOFTWARE_DEVELOPMENT`, `DIGITAL_MARKETING` | `Campaign.Type` = `SPONSORSHIP`, `EVENT` |
| **Matching Mechanics** | Admin Matchmaking Hub (`/match/`) binds talent | Club President applies via quest proposal |
| **Execution Tracking**| `StudentDeliverable` (Git Repo, Demo, Live URL) | Milestone Deliverable & Proof of Work |
| **Financial Engine** | 10% Platform fee collected on lock | Sponsoring tier payout to club bank account |

## 2. API Contract Matrix

### Individual Student Track (V3.0)
- `POST /api/users/register/student/`: Registers student talent (email, password, matric_id, university, domain_focus, portfolio_url).
- `GET /api/campaigns/student/assigned/`: Retrieves projects where student is in `campaign.assigned_students`.
- `POST /api/campaigns/<id>/match/`: Admin assigns selected students (`student_ids`) with `match_notes`.
- `POST /api/campaigns/<id>/finalize/`: Binds match, locks contract, transfers 10% platform fee to system.
- `POST /api/campaigns/<id>/student-deliverable/`: Student submits milestone or final work.
- `GET/POST /api/campaigns/<id>/assets/`: Client shares design files, tokens, API specs with matched student.

### Club Track (V2.2.1 - Postponed/Reserved)
- `POST /api/users/register/club/`: Registers student club profile.
- `GET/POST /api/users/club/invite/`: President sends shadow user invitation to roster members.
- `POST /api/campaigns/<id>/apply/`: Club submits formal proposal for campaign sponsorship.
- `POST /api/campaigns/application/<id>/award/`: Company awards sponsorship tier to club.

## 3. Database Migration Guardrails
- NEVER run `makemigrations` that drops `ClubProfile`, `ClubMember`, `ShadowUser`, or club-related transaction types.
- Always use `null=True, blank=True` on new cross-link fields to maintain backwards compatibility.\n