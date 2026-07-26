import { defineCatalog } from '@jsvision/i18n';
import type { Catalog, Message } from '@jsvision/i18n';
import { FILES_ACCELERATOR_MANIFEST, FILES_ENGLISH_CATALOG } from './catalog.js';

const MONTH_KEYS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

/** Complete translated values used to construct one Files catalog. */
interface FilesTranslation {
  readonly messages: Readonly<Record<string, Message>>;
  readonly months: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
}

/** Build one complete Files catalog from translated values and canonical English keys. */
function filesCatalog(locale: string, translation: FilesTranslation): Catalog {
  const months = Object.fromEntries(
    MONTH_KEYS.map((month, index) => [`files.info.month.${month}.short`, translation.months[index]]),
  );
  return defineCatalog(
    {
      schema: 1,
      locale,
      messages: {
        ...FILES_ENGLISH_CATALOG.messages,
        ...translation.messages,
        ...months,
      },
    },
    {
      acceleratorManifest: FILES_ACCELERATOR_MANIFEST,
      placeholderManifest: { 'files.error.invalid-file-name': ['name'] },
    },
  );
}

/** Official English Files catalog. */
export const filesEn = filesCatalog('en', {
  messages: {
    // Official catalogs use unique markers across every set of simultaneously visible controls.
    'files.action.clear': 'C~l~ear',
    'files.field.directory-name': 'Directory ~n~ame',
    'files.field.directory-tree': 'Directory ~t~ree',
  },
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
});

/** Official Dutch Files catalog. */
export const filesNl = filesCatalog('nl', {
  messages: {
    'files.action.open': '~O~penen',
    'files.action.cancel': '~A~nnuleren',
    'files.action.ok': '~G~ereed',
    'files.action.replace': '~V~ervangen',
    'files.action.clear': '~W~issen',
    'files.action.help': '~H~elp',
    'files.action.chdir': '~M~ap openen',
    'files.action.revert': '~T~erugzetten',
    'files.dialog.open.title': 'Een bestand openen',
    'files.dialog.save-as.title': 'Bestand opslaan als',
    'files.dialog.change-directory.title': 'Map wijzigen',
    'files.dialog.error.title': 'Bestandsfout',
    'files.field.name': '~N~aam',
    'files.field.list': '~B~estanden',
    'files.field.directory-name': 'Map~n~aam',
    'files.field.directory-tree': 'Mappen~b~oom',
    'files.error.invalid-file-name': "Ongeldige bestandsnaam: '${name}'",
    'files.error.invalid-drive-directory': 'Ongeldig station of ongeldige map',
    'files.error.invalid-directory': 'Ongeldige map',
    'files.info.time.am': 'am',
    'files.info.time.pm': 'pm',
  },
  months: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
});

/** Official German Files catalog. */
export const filesDe = filesCatalog('de', {
  messages: {
    'files.action.open': 'Ö~f~fnen',
    'files.action.cancel': '~A~bbrechen',
    'files.action.ok': '~O~K',
    'files.action.replace': '~E~rsetzen',
    'files.action.clear': '~L~eeren',
    'files.action.help': '~H~ilfe',
    'files.action.chdir': '~W~echseln',
    'files.action.revert': '~Z~urück',
    'files.dialog.open.title': 'Datei öffnen',
    'files.dialog.save-as.title': 'Datei speichern unter',
    'files.dialog.change-directory.title': 'Verzeichnis wechseln',
    'files.dialog.error.title': 'Dateifehler',
    'files.field.name': '~N~ame',
    'files.field.list': '~D~ateien',
    'files.field.directory-name': '~V~erzeichnisname',
    'files.field.directory-tree': 'Verzeichnis~b~aum',
    'files.error.invalid-file-name': "Ungültiger Dateiname: '${name}'",
    'files.error.invalid-drive-directory': 'Ungültiges Laufwerk oder Verzeichnis',
    'files.error.invalid-directory': 'Ungültiges Verzeichnis',
    'files.info.time.am': 'am',
    'files.info.time.pm': 'pm',
  },
  months: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
});

/** Official French Files catalog. */
export const filesFr = filesCatalog('fr', {
  messages: {
    'files.action.open': '~O~uvrir',
    'files.action.cancel': '~A~nnuler',
    'files.action.ok': '~O~K',
    'files.action.replace': '~R~emplacer',
    'files.action.clear': '~E~ffacer',
    'files.action.help': 'A~i~de',
    'files.action.chdir': '~C~hanger',
    'files.action.revert': '~R~établir',
    'files.dialog.open.title': 'Ouvrir un fichier',
    'files.dialog.save-as.title': 'Enregistrer le fichier sous',
    'files.dialog.change-directory.title': 'Changer de dossier',
    'files.dialog.error.title': 'Erreur de fichier',
    'files.field.name': '~N~om',
    'files.field.list': '~F~ichiers',
    'files.field.directory-name': 'Nom du ~d~ossier',
    'files.field.directory-tree': 'Ar~b~orescence',
    'files.error.invalid-file-name': "Nom de fichier incorrect : '${name}'",
    'files.error.invalid-drive-directory': 'Lecteur ou dossier incorrect',
    'files.error.invalid-directory': 'Dossier incorrect',
    'files.info.time.am': 'am',
    'files.info.time.pm': 'pm',
  },
  months: ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'],
});

/** Official Spanish Files catalog. */
export const filesEs = filesCatalog('es', {
  messages: {
    'files.action.open': '~A~brir',
    'files.action.cancel': '~C~ancelar',
    'files.action.ok': '~O~K',
    'files.action.replace': '~R~eemplazar',
    'files.action.clear': '~L~impiar',
    'files.action.help': 'A~y~uda',
    'files.action.chdir': '~C~ambiar',
    'files.action.revert': '~R~estaurar',
    'files.dialog.open.title': 'Abrir un archivo',
    'files.dialog.save-as.title': 'Guardar archivo como',
    'files.dialog.change-directory.title': 'Cambiar carpeta',
    'files.dialog.error.title': 'Error de archivo',
    'files.field.name': '~N~ombre',
    'files.field.list': '~F~icheros',
    'files.field.directory-name': '~N~ombre de carpeta',
    'files.field.directory-tree': 'Árbol de car~p~etas',
    'files.error.invalid-file-name': "Nombre de archivo no válido: '${name}'",
    'files.error.invalid-drive-directory': 'Unidad o carpeta no válida',
    'files.error.invalid-directory': 'Carpeta no válida',
    'files.info.time.am': 'am',
    'files.info.time.pm': 'pm',
  },
  months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
});

/** Official Italian Files catalog. */
export const filesIt = filesCatalog('it', {
  messages: {
    'files.action.open': '~A~pri',
    'files.action.cancel': 'A~n~nulla',
    'files.action.ok': '~O~K',
    'files.action.replace': '~S~ostituisci',
    'files.action.clear': '~P~ulisci',
    'files.action.help': 'A~i~uto',
    'files.action.chdir': '~C~ambia',
    'files.action.revert': '~R~ipristina',
    'files.dialog.open.title': 'Apri un file',
    'files.dialog.save-as.title': 'Salva file con nome',
    'files.dialog.change-directory.title': 'Cambia cartella',
    'files.dialog.error.title': 'Errore file',
    'files.field.name': 'No~m~e',
    'files.field.list': '~F~ile',
    'files.field.directory-name': '~N~ome cartella',
    'files.field.directory-tree': 'Albero car~t~elle',
    'files.error.invalid-file-name': "Nome file non valido: '${name}'",
    'files.error.invalid-drive-directory': 'Unità o cartella non valida',
    'files.error.invalid-directory': 'Cartella non valida',
    'files.info.time.am': 'am',
    'files.info.time.pm': 'pm',
  },
  months: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
});

/** Official European Portuguese Files catalog. */
export const filesPtPT = filesCatalog('pt-PT', {
  messages: {
    'files.action.open': '~A~brir',
    'files.action.cancel': '~C~ancelar',
    'files.action.ok': '~O~K',
    'files.action.replace': '~S~ubstituir',
    'files.action.clear': '~L~impar',
    'files.action.help': 'A~j~uda',
    'files.action.chdir': '~A~lterar',
    'files.action.revert': '~R~epor',
    'files.dialog.open.title': 'Abrir um ficheiro',
    'files.dialog.save-as.title': 'Guardar ficheiro como',
    'files.dialog.change-directory.title': 'Alterar pasta',
    'files.dialog.error.title': 'Erro de ficheiro',
    'files.field.name': '~N~ome',
    'files.field.list': '~F~icheiros',
    'files.field.directory-name': 'Nome da ~p~asta',
    'files.field.directory-tree': 'Árvore de pas~t~as',
    'files.error.invalid-file-name': "Nome de ficheiro inválido: '${name}'",
    'files.error.invalid-drive-directory': 'Unidade ou pasta inválida',
    'files.error.invalid-directory': 'Pasta inválida',
    'files.info.time.am': 'am',
    'files.info.time.pm': 'pm',
  },
  months: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
});

/** Official Polish Files catalog. */
export const filesPl = filesCatalog('pl', {
  messages: {
    'files.action.open': '~O~twórz',
    'files.action.cancel': '~A~nuluj',
    'files.action.ok': '~O~K',
    'files.action.replace': '~Z~astąp',
    'files.action.clear': '~W~yczyść',
    'files.action.help': '~P~omoc',
    'files.action.chdir': '~Z~mień',
    'files.action.revert': 'Przyw~r~óć',
    'files.dialog.open.title': 'Otwórz plik',
    'files.dialog.save-as.title': 'Zapisz plik jako',
    'files.dialog.change-directory.title': 'Zmień katalog',
    'files.dialog.error.title': 'Błąd pliku',
    'files.field.name': '~N~azwa',
    'files.field.list': 'P~l~iki',
    'files.field.directory-name': 'Nazwa ~k~atalogu',
    'files.field.directory-tree': 'Drzewo ka~t~alogów',
    'files.error.invalid-file-name': "Nieprawidłowa nazwa pliku: '${name}'",
    'files.error.invalid-drive-directory': 'Nieprawidłowy dysk lub katalog',
    'files.error.invalid-directory': 'Nieprawidłowy katalog',
    'files.info.time.am': 'am',
    'files.info.time.pm': 'pm',
  },
  months: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'],
});

/** Official Romanian Files catalog. */
export const filesRo = filesCatalog('ro', {
  messages: {
    'files.action.open': '~D~eschide',
    'files.action.cancel': '~A~nulează',
    'files.action.ok': '~O~K',
    'files.action.replace': 'În~l~ocuiește',
    'files.action.clear': 'Ș~t~erge',
    'files.action.help': 'A~j~utor',
    'files.action.chdir': '~S~chimbă',
    'files.action.revert': '~R~evino',
    'files.dialog.open.title': 'Deschide un fișier',
    'files.dialog.save-as.title': 'Salvează fișierul ca',
    'files.dialog.change-directory.title': 'Schimbă dosarul',
    'files.dialog.error.title': 'Eroare de fișier',
    'files.field.name': '~N~ume',
    'files.field.list': '~F~ișiere',
    'files.field.directory-name': 'Nume ~d~osar',
    'files.field.directory-tree': 'Arbore dosar~e~',
    'files.error.invalid-file-name': "Nume de fișier nevalid: '${name}'",
    'files.error.invalid-drive-directory': 'Unitate sau dosar nevalid',
    'files.error.invalid-directory': 'Dosar nevalid',
    'files.info.time.am': 'am',
    'files.info.time.pm': 'pm',
  },
  months: ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'],
});

/** Official Swedish Files catalog. */
export const filesSv = filesCatalog('sv', {
  messages: {
    'files.action.open': 'Ö~p~pna',
    'files.action.cancel': '~A~vbryt',
    'files.action.ok': '~O~K',
    'files.action.replace': '~E~rsätt',
    'files.action.clear': '~R~ensa',
    'files.action.help': '~H~jälp',
    'files.action.chdir': '~B~yt',
    'files.action.revert': 'Å~t~erställ',
    'files.dialog.open.title': 'Öppna en fil',
    'files.dialog.save-as.title': 'Spara fil som',
    'files.dialog.change-directory.title': 'Byt mapp',
    'files.dialog.error.title': 'Filfel',
    'files.field.name': '~N~amn',
    'files.field.list': '~F~iler',
    'files.field.directory-name': '~M~appnamn',
    'files.field.directory-tree': 'Mappträ~d~',
    'files.error.invalid-file-name': "Ogiltigt filnamn: '${name}'",
    'files.error.invalid-drive-directory': 'Ogiltig enhet eller mapp',
    'files.error.invalid-directory': 'Ogiltig mapp',
    'files.info.time.am': 'fm',
    'files.info.time.pm': 'em',
  },
  months: ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
});
