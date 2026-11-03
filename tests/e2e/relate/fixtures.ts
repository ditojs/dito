import { defineScenario } from '../../utils/fixture-app.js'
import { Playlist } from './models/Playlist.js'
import { Track } from './models/Track.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Playlist, Track],
  controllers: {
    // The tracks are owned and written nested, and relate to each other,
    // also to new tracks through `#id` / `#ref` references. The next tracks
    // go out as references, `{ id }`, which the admin replaces with their
    // options.
    Playlist: {
      find: {
        populate: ['tracks.nextTrack'],
        fields: ['id', 'name', 'tracks.*', 'tracks.nextTrack.id']
      }
    }
  }
})
