declare global {
  namespace NodeJS {
    interface ProcessEnv {
      TVDB_API_KEY: string;
    }
  }
}

export {}
