export type ChapterDisplay = {
  ChapterString: string
  ChapterLanguage: string
}

export type ChapterAtom = {
  ChapterUID: string
  ChapterTimeStart: string
  ChapterTimeEnd: string
  ChapterFlagHidden: string
  ChapterFlagEnabled: string
  ChapterDisplay: ChapterDisplay
}

export type EditionEntry = {
  EditionFlagHidden: string
  EditionFlagDefault: string
  EditionUID: string
  ChapterAtom: ChapterAtom[]
}

export type Chapters = {
  EditionEntry: EditionEntry
}

export type ChaptersXml = {
  Chapters: Chapters
}
