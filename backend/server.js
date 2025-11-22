{
  "name": "ec0301-globalskillscert-backend",
  "version": "2.0.0",
  "description": "Backend API para EC0301 GlobalSkillsCert - Sistema de diseño instruccional",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "postmark": "^3.12.0",
    "stripe": "^14.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "ec0301",
    "conocer",
    "capacitacion",
    "stripe"
  ],
  "author": "GlobalSkillsCert",
  "license": "MIT"
}
