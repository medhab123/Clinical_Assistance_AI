@echo off
echo Starting Clinical Assistant AI...
echo.

REM Activate virtual environment if it exists
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

REM Check if .env file exists
if not exist .env (
    echo WARNING: .env file not found!
    echo Please create a .env file with your OPENAI_API_KEY
    echo Example:
    echo OPENAI_API_KEY=your_key_here
    echo.
    pause
)

echo Starting Flask server...
python app.py

