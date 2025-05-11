# The Current-See Changelog

All notable changes to The Current-See project will be documented in this file.

## v1.2.1 (2025.05.11)

### Added
- Added support for new member "Erin Lee" with proper data formatting
- Improved refresh button functionality on members list with proper error handling
- Enhanced embedded data loading with multiple fallback methods

### Fixed
- Resolved members list display inconsistencies across all pages
- Fixed SOLAR amount formatting to handle both property naming conventions
- Improved error resilience in public members log display
- Updated member capitalization for consistency

## v1.2.0 (2025.04.24)

### Added
- Comprehensive version tracking system (v1.2.0)
- New `/api/version` endpoint for monitoring application status
- Enhanced `/health` endpoint with expanded status information
- Improved OpenAI integration with graceful degradation
- Feature toggle system for enabling/disabling AI features
- Utility scripts for version and feature management

### Fixed
- OpenAI API key handling to support project-scoped keys (sk-proj-*)
- Server startup log improvements with clearer service availability status
- Database connection error handling with better error messages

## v1.1.0 (2025.04.18)

### Added
- PostgreSQL database integration for member storage
- Enhanced error handling for database connections
- Multi-layered approach for email preservation
- Created database backup system
- Improved signup process with email validation

### Fixed
- File-based member storage data loss issues
- Email preservation system with redundancy
- Database connection issues in deployment environments

## v1.0.0 (2025.04.07)

### Added
- Initial release of The Current-See platform
- Solar Generator with real-time energy production tracking
- Member management system
- Basic distribution system for SOLAR allocations
- Public website with informational pages
- AI-assisted energy tools with OpenAI integration