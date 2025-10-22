# Use the official Node.js image from the Docker Hub
FROM node:18-slim

# Set the working directory
WORKDIR /app

# Copy the rest of the application code into the container
COPY . .

RUN rm -rf node_modules
RUN rm -f package-lock.json 

# Install the dependencies
RUN npm install

# Expose the port the app runs on
EXPOSE 5173

# Command to run the application
CMD ["npm", "run", "dev", "--", "--host"]