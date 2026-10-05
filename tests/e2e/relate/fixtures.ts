import { defineScenario, ScenarioController } from '../../utils/fixture-app.js'
import { Playlist } from './models/Playlist.js'
import { Track } from './models/Track.js'

export { expect } from '@playwright/test'

class Playlists extends ScenarioController {
  override modelClass = Playlist
  // `graph = true` saves the tracks and the relations between them, including
  // relations to new tracks through Objection's `#id` / `#ref` references.
  override scope = ['^withTracks']
  override graph = true
}

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Playlist, Track },
  controllers: { Playlists }
})
