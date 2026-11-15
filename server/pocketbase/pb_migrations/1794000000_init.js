/// <reference path="../pb_data/types.d.ts" />

// Schema + Zugriffsregeln für StablefordCalc (Ersatz für supabase/migrations/0001+0002).
// Identität: jedes Gerät registriert sich beim ersten Start selbst als `users`-Datensatz
// (anonym, Zufallszugang im localStorage) — das Gegenstück zu Supabase signInAnonymously().
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.authToken.duration = 60 * 60 * 24 * 365
    app.save(users)

    const authed = '@request.auth.id != ""'

    const courses = new Collection({
      type: 'base',
      name: 'courses',
      listRule: '',
      viewRule: '',
      createRule: authed,
      updateRule: authed,
      deleteRule: authed,
      fields: [
        {
          name: 'id',
          type: 'text',
          primaryKey: true,
          system: true,
          required: true,
          min: 15,
          max: 36,
          pattern: '^[a-z0-9-]+$',
          autogeneratePattern: '[a-z0-9]{15}',
        },
        { name: 'name', type: 'text', required: true },
        { name: 'sort_key', type: 'text' },
        { name: 'hole_count', type: 'number', required: true, onlyInt: true },
        { name: 'tees', type: 'json', maxSize: 1000000 },
        { name: 'holes', type: 'json', maxSize: 1000000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(courses)

    const liveRounds = new Collection({
      type: 'base',
      name: 'live_rounds',
      listRule: '',
      viewRule: '',
      createRule: authed + ' && @request.body.created_by = @request.auth.id',
      updateRule: 'created_by = @request.auth.id',
      deleteRule: 'created_by = @request.auth.id',
      fields: [
        { name: 'code', type: 'text', required: true, min: 4, max: 10 },
        { name: 'course_id', type: 'text', required: true },
        { name: 'game_mode', type: 'text', required: true },
        { name: 'status', type: 'text' },
        {
          name: 'created_by',
          type: 'relation',
          required: true,
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_live_rounds_code ON live_rounds (code)'],
    })
    app.save(liveRounds)

    const livePlayers = new Collection({
      type: 'base',
      name: 'live_round_players',
      listRule: '',
      viewRule: '',
      // Nur der Ersteller der Runde darf Spieler-Slots anlegen.
      createRule:
        authed +
        ' && @collection.live_rounds.id ?= @request.body.live_round_id' +
        ' && @collection.live_rounds.created_by ?= @request.auth.id',
      // Slot beanspruchen: nur wenn frei (oder bereits der eigene), nur claimed_by/claimed_at ändern.
      updateRule:
        authed +
        ' && (claimed_by = "" || claimed_by = @request.auth.id)' +
        ' && @request.body.claimed_by = @request.auth.id' +
        ' && @request.body.live_round_id:isset = false' +
        ' && @request.body.player_id:isset = false' +
        ' && @request.body.first_name:isset = false' +
        ' && @request.body.last_name:isset = false' +
        ' && @request.body.handicap:isset = false' +
        ' && @request.body.gender:isset = false' +
        ' && @request.body.tee_id:isset = false',
      deleteRule: null,
      fields: [
        {
          name: 'live_round_id',
          type: 'relation',
          required: true,
          collectionId: liveRounds.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'player_id', type: 'text', required: true },
        { name: 'first_name', type: 'text' },
        { name: 'last_name', type: 'text' },
        { name: 'handicap', type: 'number' },
        { name: 'gender', type: 'text' },
        { name: 'tee_id', type: 'text' },
        {
          name: 'claimed_by',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'claimed_at', type: 'date' },
      ],
    })
    app.save(livePlayers)

    const liveScores = new Collection({
      type: 'base',
      name: 'live_round_scores',
      listRule: '',
      viewRule: '',
      // Scores darf nur schreiben, wem der Slot gehört (und nur passend zur Runde des Slots).
      createRule:
        authed +
        ' && @collection.live_round_players.id ?= @request.body.slot_id' +
        ' && @collection.live_round_players.claimed_by ?= @request.auth.id' +
        ' && @collection.live_round_players.live_round_id ?= @request.body.live_round_id',
      updateRule:
        authed +
        ' && slot_id.claimed_by = @request.auth.id' +
        ' && @request.body.slot_id:isset = false' +
        ' && @request.body.live_round_id:isset = false' +
        ' && @request.body.hole_number:isset = false',
      deleteRule: null,
      fields: [
        {
          name: 'live_round_id',
          type: 'relation',
          required: true,
          collectionId: liveRounds.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'slot_id',
          type: 'relation',
          required: true,
          collectionId: livePlayers.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'hole_number', type: 'number', required: true, onlyInt: true, min: 1, max: 18 },
        // 0 bedeutet "kein Ergebnis" (Schläge sind immer >= 1).
        { name: 'strokes', type: 'number', onlyInt: true },
        { name: 'picked_up', type: 'bool' },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_live_scores_slot_hole ON live_round_scores (slot_id, hole_number)'],
    })
    app.save(liveScores)
  },
  (app) => {
    for (const name of ['live_round_scores', 'live_round_players', 'live_rounds', 'courses']) {
      app.delete(app.findCollectionByNameOrId(name))
    }
  },
)
