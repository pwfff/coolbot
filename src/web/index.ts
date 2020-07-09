import PouchDB from 'pouchdb';
import express from 'express';

async function app(): Promise<express.Express> {
  const handler = require('express-pouchdb')();
  await handler.setPouchDB(PouchDB.defaults({
    prefix: './database/',
  }));

  const app = express();
  app.use('/db', handler);

  app.get('/', async (req: any, res: any) => {
    res.send('home');
  });

  return app;
}

export default app;
