-- sync_meals.applescript
-- Reads "Meal Database" from Apple Notes, updates meals.js, and git pushes.
-- Run daily via launchd — see com.mealprep.sync.plist for setup.

property repoPath : "/Users/liammiller/Projects/meal-prep"

-- 1. Read note from Apple Notes
tell application "Notes"
	set matchingNotes to notes whose name is "Meal Database"
	if (count of matchingNotes) is 0 then
		error "Apple Note named 'Meal Database' not found. Please create it with the correct format."
	end if
	set noteText to plaintext of item 1 of matchingNotes
end tell

-- 2. Write note content to a temp file
set tmpFile to do shell script "mktemp /tmp/meal_note_XXXXXX.txt"
do shell script "printf '%s' " & quoted form of noteText & " > " & quoted form of tmpFile

-- 3. Parse note and write meals.js
set parseScript to repoPath & "/parse_note.py"
set mealsJs to repoPath & "/meals.js"
do shell script "python3 " & quoted form of parseScript & " " & quoted form of tmpFile & " " & quoted form of mealsJs

-- 4. Clean up temp file
do shell script "rm -f " & quoted form of tmpFile

-- 5. Commit and push if meals.js changed
do shell script "cd " & quoted form of repoPath & " && git add meals.js && if ! git diff --cached --quiet; then git commit -m 'sync: update meals from Apple Notes' && git push; fi"
