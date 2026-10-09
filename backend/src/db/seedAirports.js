// Inserts demo airports only if none exist. Use in cloud mode, where
// users come from Cognito and the full demo seed (local users) is not wanted.
const { Airports } = require('./repository');

if (Airports.list().length === 0) {
  Airports.create({ code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'USA', terminals: ['Terminal 1', 'Terminal 4', 'Terminal 5', 'Terminal 8'] });
  Airports.create({ code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'USA', terminals: ['Terminal 1', 'Terminal 3', 'Tom Bradley Int'] });
  console.log('Airports seeded.');
} else {
  console.log('Airports already present; nothing to do.');
}
