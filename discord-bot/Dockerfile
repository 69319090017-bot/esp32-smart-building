# Use slim Python 3.11 image for smaller footprint
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
# Make sure you have a .dockerignore file that ignores:
# - .git
# - __pycache__
# - *.pyc
# - .env
COPY . .

# Expose the health check port
EXPOSE 8080

# Command to run the bot
CMD ["python", "discord_bot.py"]
