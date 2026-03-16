// DEFAULTS: CST = Central Standard Time, PST = Pacific Standard Time, BST = British Summer Time, AST = Atlantic Standard Time, IST = Irish Standard Time

export const timezoneOffsets = {
  /*********************************
   * MILITARY / NAUTICAL TIME ZONES
   *********************************/
  "A": 1, // Alpha Time Zone
  "B": 2, // Bravo Time Zone
  "C": 3, // Charlie Time Zone
  "D": 4, // Delta Time Zone
  "E": 5, // Echo Time Zone
  "F": 6, // Foxtrot Time Zone
  "G": 7, // Golf Time Zone
  "H": 8, // Hotel Time Zone
  "I": 9, // India Time Zone
  "K": 10, // Kilo Time Zone
  "L": 11, // Lima Time Zone
  "M": 12, // Mike Time Zone
  "N": -1, // November Time Zone
  "O": -2, // Oscar Time Zone
  "P": -3, // Papa Time Zone
  "Q": -4, // Quebec Time Zone
  "R": -5, // Romeo Time Zone
  "S": -6, // Sierra Time Zone
  "T": -7, // Tango Time Zone
  "U": -8, // Uniform Time Zone
  "V": -9, // Victor Time Zone
  "W": -10, // Whiskey Time Zone
  "X": -11, // X-ray Time Zone
  "Y": -12, // Yankee Time Zone
  "Z": 0, // Zulu Time Zone / UTC

  /****************
   * UTC / GMT BASE
   ****************/
  "GMT": 0, // Greenwich Mean Time
  "WT": 0, // Western Sahara Standard Time / generic Western Time label

  /****************************
   * EXPLICIT UTC OFFSET TOKENS
   ****************************/
  "UTC": 0, // Coordinated Universal Time
  "UTC-12": -12, // UTC minus 12 hours
  "UTC-11": -11, // UTC minus 11 hours
  "UTC-10": -10, // UTC minus 10 hours
  "UTC-9:30": -9.5, // UTC minus 9 hours 30 minutes
  "UTC-9": -9, // UTC minus 9 hours
  "UTC-8": -8, // UTC minus 8 hours
  "UTC-7": -7, // UTC minus 7 hours
  "UTC-6": -6, // UTC minus 6 hours
  "UTC-5": -5, // UTC minus 5 hours
  "UTC-4": -4, // UTC minus 4 hours
  "UTC-3:30": -3.5, // UTC minus 3 hours 30 minutes
  "UTC-3": -3, // UTC minus 3 hours
  "UTC-2:30": -2.5, // UTC minus 2 hours 30 minutes
  "UTC-2": -2, // UTC minus 2 hours
  "UTC-1": -1, // UTC minus 1 hour
  "UTC-0": 0, // UTC minus 0 hours
  "UTC+0": 0, // UTC plus 0 hours
  "UTC+1": 1, // UTC plus 1 hour
  "UTC+2": 2, // UTC plus 2 hours
  "UTC+3": 3, // UTC plus 3 hours
  "UTC+3:30": 3.5, // UTC plus 3 hours 30 minutes
  "UTC+4": 4, // UTC plus 4 hours
  "UTC+4:30": 4.5, // UTC plus 4 hours 30 minutes
  "UTC+5": 5, // UTC plus 5 hours
  "UTC+5:30": 5.5, // UTC plus 5 hours 30 minutes
  "UTC+5:45": 5.75, // UTC plus 5 hours 45 minutes
  "UTC+6": 6, // UTC plus 6 hours
  "UTC+6:30": 6.5, // UTC plus 6 hours 30 minutes
  "UTC+7": 7, // UTC plus 7 hours
  "UTC+8": 8, // UTC plus 8 hours
  "UTC+8:45": 8.75, // UTC plus 8 hours 45 minutes
  "UTC+9": 9, // UTC plus 9 hours
  "UTC+9:30": 9.5, // UTC plus 9 hours 30 minutes
  "UTC+10": 10, // UTC plus 10 hours
  "UTC+10:30": 10.5, // UTC plus 10 hours 30 minutes
  "UTC+11": 11, // UTC plus 11 hours
  "UTC+12": 12, // UTC plus 12 hours
  "UTC+12:45": 12.75, // UTC plus 12 hours 45 minutes
  "UTC+13": 13, // UTC plus 13 hours
  "UTC+14": 14, // UTC plus 14 hours

  /****************
   * AFRICA / EUROPE
   ****************/
  "AZOT": -1, // Azores Time
  "AZOST": 0, // Azores Summer Time
  "BST": 1, // British Summer Time
  "CAT": 2, // Central Africa Time
  "CET": 1, // Central European Time
  "CEST": 2, // Central European Summer Time
  "EAT": 3, // East Africa Time
  "EET": 2, // Eastern European Time
  "EEST": 3, // Eastern European Summer Time
  "EGT": -1, // Eastern Greenland Time
  "EGST": 0, // Eastern Greenland Summer Time
  "FET": 3, // Further-eastern European Time
  "GET": 4, // Georgia Standard Time
  "IST": 1, // Irish Standard Time
  "MSK": 3, // Moscow Time
  "MSD": 4, // Moscow Daylight Time
  "SAST": 2, // South Africa Standard Time
  "WAT": 1, // West Africa Time
  "WAST": 2, // West Africa Summer Time
  "WEST": 1, // Western European Summer Time
  "WET": 0, // Western European Time

  /********
   * ASIA
   ********/
  "AFT": 4.5, // Afghanistan Time
  "ALMT": 6, // Alma-Ata Time
  "AMT-ASIA": 4, // Armenia Time
  "AMST-ARMENIA": 5, // Armenia Summer Time
  "ANAST": 12, // Anadyr Summer Time
  "ANAT": 12, // Anadyr Time
  "AQTT": 5, // Aqtobe Time
  "AST-ARABIA": 3, // Arabia Standard Time
  "AZST": 5, // Azerbaijan Summer Time
  "AZT": 4, // Azerbaijan Time
  "BNT": 8, // Brunei Darussalam Time
  "BST-ASIA": 6, // Bangladesh Standard Time
  "BTT": 6, // Bhutan Time
  "CAST": 8, // Casey Time
  "CCT": 6.5, // Cocos Islands Time
  "CHOST": 9, // Choibalsan Summer Time
  "CHOT": 8, // Choibalsan Time
  "CST-ASIA": 8, // China Standard Time
  "DAVT": 7, // Davis Time
  "DDUT": 10, // Dumont d’Urville Time
  "GST-ASIA": 4, // Gulf Standard Time
  "HKT": 8, // Hong Kong Time
  "HOVST": 8, // Hovd Summer Time
  "HOVT": 7, // Hovd Time
  "ICT": 7, // Indochina Time
  "IDT": 3, // Israel Daylight Time
  "IOT": 6, // Indian Ocean Time
  "IRDT": 4.5, // Iran Daylight Time
  "IRKST": 9, // Irkutsk Summer Time
  "IRKT": 8, // Irkutsk Time
  "IRST": 3.5, // Iran Standard Time
  "IST-ASIA": 2, // Israel Standard Time
  "IST-INDIA": 5.5, // India Standard Time
  "JST": 9, // Japan Standard Time
  "KGT": 6, // Kyrgyzstan Time
  "KOST": 11, // Kosrae Time
  "KRAST": 8, // Krasnoyarsk Summer Time
  "KRAT": 7, // Krasnoyarsk Time
  "KST": 9, // Korea Standard Time
  "KUYT": 4, // Kuybyshev Time
  "MAGST": 12, // Magadan Summer Time
  "MAGT": 11, // Magadan Time
  "MAWT": 5, // Mawson Time
  "MMT": 6.5, // Myanmar Time
  "MUT": 4, // Mauritius Time
  "MVT": 5, // Maldives Time
  "MYT": 8, // Malaysia Time
  "NOVST": 7, // Novosibirsk Summer Time
  "NOVT": 7, // Novosibirsk Time
  "NPT": 5.75, // Nepal Time
  "OMSST": 7, // Omsk Summer Time
  "OMST": 6, // Omsk Time
  "ORAT": 5, // Oral Time
  "PETST": 12, // Kamchatka Summer Time / Petropavlovsk-Kamchatski Summer Time
  "PETT": 12, // Kamchatka Time / Petropavlovsk-Kamchatski Time
  "PHT": 8, // Philippine Time
  "PKT": 5, // Pakistan Standard Time
  "PONT": 11, // Pohnpei Time
  "PYT-PYONGYANG": 8.5, // Pyongyang Time
  "QYZT": 6, // Qyzylorda Time
  "SAKT": 11, // Sakhalin Time
  "SAMT": 4, // Samara Time
  "SGT": 8, // Singapore Time
  "SRET": 11, // Srednekolymsk Time
  "TJT": 5, // Tajikistan Time
  "TLT": 9, // Timor Leste Time
  "TMT": 5, // Turkmenistan Time
  "TRT": 3, // Türkiye Time
  "ULAST": 9, // Ulaanbaatar Summer Time
  "ULAT": 8, // Ulaanbaatar Time
  "UZT": 5, // Uzbekistan Time
  "VLAST": 11, // Vladivostok Summer Time
  "VLAT": 10, // Vladivostok Time
  "VOST": 6, // Vostok Time
  "WIB": 7, // Western Indonesia Time
  "WITA": 8, // Central Indonesia Time
  "WIT": 9, // Eastern Indonesia Time
  "YAKST": 10, // Yakutsk Summer Time
  "YAKT": 9, // Yakutsk Time
  "YEKST": 6, // Yekaterinburg Summer Time
  "YEKT": 5, // Yekaterinburg Time

  /************************
   * AUSTRALIA / OCEANIA
   ************************/
  "ACDT": 10.5, // Australian Central Daylight Time
  "ACST": 9.5, // Australian Central Standard Time
  "ACT-AUSTRALIA": [9.5, 10.5], // Australian Central Time [standard, daylight]
  "ACWST": 8.75, // Australian Central Western Standard Time
  "AEDT": 11, // Australian Eastern Daylight Time
  "AEST": 10, // Australian Eastern Standard Time
  "AET": [10, 11], // Australian Eastern Time [standard, daylight]
  "AWDT": 9, // Australian Western Daylight Time
  "AWST": 8, // Australian Western Standard Time
  "BST-PACIFIC": 11, // Bougainville Standard Time
  "CHADT": 13.75, // Chatham Daylight Time
  "CHAST": 12.75, // Chatham Standard Time
  "CHUT": 10, // Chuuk Time
  "CHST": 10, // Chamorro Standard Time
  "CXT": 7, // Christmas Island Time
  "FJST": 13, // Fiji Summer Time
  "FJT": 12, // Fiji Time
  "GILT": 12, // Gilbert Island Time
  "LHDT": 11, // Lord Howe Daylight Time
  "LHST": 10.5, // Lord Howe Standard Time
  "LINT": 14, // Line Islands Time
  "MHT": 12, // Marshall Islands Time
  "NCT": 11, // New Caledonia Time
  "NFDT": 12, // Norfolk Daylight Time
  "NFT": 11, // Norfolk Time
  "NRT": 12, // Nauru Time
  "NZDT": 13, // New Zealand Daylight Time
  "NZST": 12, // New Zealand Standard Time
  "PGT": 10, // Papua New Guinea Time
  "PHOT": 13, // Phoenix Island Time
  "PWT": 9, // Palau Time
  "SBT": 11, // Solomon Islands Time
  "SYOT": 3, // Syowa Time
  "TKT": 13, // Tokelau Time
  "TOST": 14, // Tonga Summer Time
  "TOT": 13, // Tonga Time
  "TVT": 12, // Tuvalu Time
  "VUT": 11, // Vanuatu Time
  "WAKT": 12, // Wake Island Time
  "WFT": 12, // Wallis and Futuna Time
  "WST-VARIANT1": 13, // Samoa Standard Time / West Samoa Time variant
  "YAPT": 10, // Yap Time

  /************************************
   * AMERICAS / ATLANTIC / CARIBBEAN
   ************************************/
  "ACT-SOUTHAMERICA": -5, // Acre Time
  "ADT-NORTHAMERICA": -3, // Atlantic Daylight Time
  "AMST-SOUTHAMERICA": -3, // Amazon Summer Time
  "AMT-SOUTHAMERICA": -4, // Amazon Time
  "AOE": -12, // Anywhere on Earth
  "ART": -3, // Argentina Time
  "AST": -4, // Atlantic Standard Time
  "AT": [-4, -3], // Atlantic Time [standard, daylight]
  "BOT": -4, // Bolivia Time
  "BRST": -2, // Brasília Summer Time
  "BRT": -3, // Brasília Time
  "CDT-CARIBBEAN": -4, // Cuba Daylight Time / Caribbean daylight variant
  "CDT": -5, // Central Daylight Time
  "CIDST": -4, // Cayman Islands Daylight Saving Time
  "CIST": -5, // Cayman Islands Standard Time
  "CKT": -10, // Cook Island Time
  "CLST": -3, // Chile Summer Time
  "CLT": -4, // Chile Standard Time
  "COT": -5, // Colombia Time
  "CST-CARIBBEAN": -5, // Cuba Standard Time / Caribbean standard variant
  "CST": -6, // Central Standard Time
  "CT": [-6, -5], // Central Time [standard, daylight]
  "CVT": -1, // Cape Verde Time
  "EASST": -5, // Easter Island Summer Time
  "EAST": -6, // Easter Island Standard Time
  "ECT": -5, // Ecuador Time
  "EDT": -4, // Eastern Daylight Time
  "EST": -5, // Eastern Standard Time
  "ET": [-5, -4], // Eastern Time [standard, daylight]
  "FKST": -3, // Falkland Islands Summer Time
  "FKT": -4, // Falkland Islands Time
  "FNT": -2, // Fernando de Noronha Time
  "GALT": -6, // Galápagos Time
  "GAMT": -9, // Gambier Time
  "GFT": -3, // French Guiana Time
  "GST-SOUTHAMERICA": -2, // South Georgia Time variant
  "GYT": -4, // Guyana Time
  "HDT": -9, // Hawaii-Aleutian Daylight Time
  "HST": -10, // Hawaii-Aleutian Standard Time
  "MART": -9.5, // Marquesas Time
  "MDT": -6, // Mountain Daylight Time
  "MST": -7, // Mountain Standard Time
  "MT": [-7, -6], // Mountain Time [standard, daylight]
  "NDT": -2.5, // Newfoundland Daylight Time
  "NST": -3.5, // Newfoundland Standard Time
  "NUT": -11, // Niue Time
  "PDT": -7, // Pacific Daylight Time
  "PET": -5, // Peru Time
  "PMDT": -2, // Saint Pierre and Miquelon Daylight Time
  "PMST": -3, // Saint Pierre and Miquelon Standard Time
  "PST": -8, // Pitcairn Standard Time / Pacific variant
  "PT": [-8, -7], // Pacific Time [standard, daylight]
  "PYST": -3, // Paraguay Summer Time
  "PYT-SOUTHAMERICA": -3, // Paraguay Time variant in this map
  "RET": 4, // Réunion Time
  "ROTT": -3, // Rothera Time
  "SRT": -3, // Suriname Time
  "SST": -11, // Samoa Standard Time
  "TAHT": -10, // Tahiti Time
  "UYST": -2, // Uruguay Summer Time
  "UYT": -3, // Uruguay Time
  "VET": -4, // Venezuelan Standard Time
  "WARST": -3, // Western Argentina Summer Time
  "WGST": -1, // Western Greenland Summer Time
  "WGT": -2, // Western Greenland Time

  /****************
   * OTHER / REMOTE
   ****************/
  "TFT": 5, // French Southern and Antarctic Time
};

// links and information
// https://www.timeanddate.com/time/zones/