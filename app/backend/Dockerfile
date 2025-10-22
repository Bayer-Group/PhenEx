FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .

RUN pip install --root-user-action=ignore --upgrade  pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Create data directories in /app
RUN mkdir -p /app/data/cohorts && \
    mkdir -p /app/data/users

CMD python -m fastapi run main.py --reload
