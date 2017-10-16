import { address, date, internet, lorem, name, random } from 'faker'

const dummies = []
const dogs = ['Trudel', 'Barry', 'Josef', 'Sabine']
const colors = ['blue', 'red', 'pink', 'green']

function getRandomEntries(array, min, max) {
  const shuffled = array.sort(() => 0.5 - Math.random())
  return shuffled.slice(0, min + Math.round(Math.random() * (max - min)))
}

for (let i = 0; i < 55; i++) {
  const number = `${i + 1}`.padStart(2, '0')
  dummies.push({
    firstName: name.firstName(),
    lastName: `${number} ${name.firstName()}`,
    prefix: name.prefix().toLowerCase().replace(/\./g, ''),
    country: address.countryCode(),
    dateOfBirth: date.past(100),
    email: internet.email(),
    dogs: getRandomEntries(dogs, 1, 3),
    age: random.number({ min: 2, max: 5 }) * 10,
    factor: +(Math.random() + 0.5).toFixed(2),
    colors: getRandomEntries(colors, 1, 4),
    verified: random.boolean(),
    comments: lorem.sentence()
  })
}

export default dummies
