# Story Planning Website

A local website for story point voting with hidden estimates and BA-controlled reveal.

## Flow

1. BA opens the website and creates a session.
2. The website generates two links:
   - Participant link for the team
   - Private BA link for reveal and reset
3. Users open the participant link and enter their own name and story point.
4. Nobody sees names or points before reveal.
5. BA opens the private link and clicks `Reveal Points`.
6. After reveal, names and story points are shown.

## Run locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Deployment

This project is fully file based. You can copy the whole folder to your server and run `node server.js` there.

## Notes

- Data is stored in `data/store.json`.
- `Reset Round` clears the current story session and hides all points again.
