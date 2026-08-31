- [x] service complaints shouldn't become completed with 'pending review' cost responsibility. 
- [x] email change verification — OTP sent to the new address (POST /users/me/email/{send-otp,verify}); PATCH /users/{id} now rejects email changes

- [x] facility employee can now merge any set (>2) of open public services (POST /public-services/merge) and unmerge a still-unassigned combined page (POST /public-services/{id}/unmerge)
- [x] let facility manager suspend resident/staff/employee accounts
- [x] admin view which CRUDs facility managers

- phone verification — editing phone number is now disabled in the app (immutable via API); still no verified change path
- proper notifications