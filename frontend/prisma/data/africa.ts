/**
 * Africa expansion geography: first-level regions and major-city districts for every market
 * beyond the two launch countries (UG/KE keep their detailed zone data in geo.ts).
 *
 * New countries ship WITHOUT delivery zones — a district with no zone is "we do not deliver
 * there yet", which checkout already handles. Ops prices a country by creating zones under
 * /admin/zones and assigning districts to them.
 *
 * Region/district codes are generated as slugs by the expansion seed script.
 */

export type AfricaExpansionSeed = {
  code: string;
  regions: string[];
  /** [city name, region name, isMajor?] */
  districts: Array<[string, string] | [string, string, true]>;
};

export const AFRICA_EXPANSION: AfricaExpansionSeed[] = [
  {
    code: 'DZ',
    regions: ['Algiers', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna', 'Sétif', 'Tlemcen', 'Béjaïa', 'Tizi Ouzou', 'Djelfa', 'Biskra', 'Chlef', 'Skikda', 'Mostaganem'],
    districts: [['Algiers', 'Algiers', true], ['Oran', 'Oran', true], ['Constantine', 'Constantine', true], ['Annaba', 'Annaba']],
  },
  {
    code: 'AO',
    regions: ['Luanda', 'Benguela', 'Huíla', 'Huambo', 'Cabinda', 'Cunene', 'Namibe', 'Malanje', 'Bié', 'Moxico', 'Uíge', 'Zaire', 'Lunda Norte', 'Lunda Sul', 'Cuanza Norte', 'Cuanza Sul', 'Bengo', 'Cuando Cubango'],
    districts: [['Luanda', 'Luanda', true], ['Benguela', 'Benguela'], ['Huambo', 'Huambo'], ['Lubango', 'Huíla']],
  },
  {
    code: 'BJ',
    regions: ['Littoral', 'Atlantique', 'Ouémé', 'Borgou', 'Alibori', 'Atacora', 'Donga', 'Zou', 'Collines', 'Mono', 'Couffo', 'Plateau'],
    districts: [['Cotonou', 'Littoral', true], ['Porto-Novo', 'Ouémé', true], ['Parakou', 'Borgou']],
  },
  {
    code: 'BW',
    regions: ['South-East', 'North-East', 'Kweneng', 'Kgatleng', 'Southern', 'North-West', 'Ghanzi', 'Kgalagadi', 'Central', 'Chobe'],
    districts: [['Gaborone', 'South-East', true], ['Francistown', 'North-East', true], ['Maun', 'North-West']],
  },
  {
    code: 'BF',
    regions: ['Centre', 'Hauts-Bassins', 'Boucle du Mouhoun', 'Cascades', 'Centre-Est', 'Centre-Nord', 'Centre-Ouest', 'Centre-Sud', 'Est', 'Nord', 'Plateau-Central', 'Sahel', 'Sud-Ouest'],
    districts: [['Ouagadougou', 'Centre', true], ['Bobo-Dioulasso', 'Hauts-Bassins', true]],
  },
  {
    code: 'BI',
    regions: ['Bujumbura Mairie', 'Bujumbura Rural', 'Gitega', 'Ngozi', 'Muyinga', 'Kirundo', 'Rumonge', 'Bururi', 'Makamba', 'Rutana', 'Ruyigi', 'Cankuzo', 'Karuzi', 'Kayanza', 'Muramvya', 'Mwaro', 'Cibitoke', 'Bubanza'],
    districts: [['Bujumbura', 'Bujumbura Mairie', true], ['Gitega', 'Gitega', true]],
  },
  {
    code: 'CV',
    regions: ['Santiago', 'São Vicente', 'Sal', 'Boa Vista', 'Santo Antão', 'São Nicolau', 'Fogo', 'Brava', 'Maio'],
    districts: [['Praia', 'Santiago', true], ['Mindelo', 'São Vicente', true], ['Espargos', 'Sal']],
  },
  {
    code: 'CM',
    regions: ['Centre', 'Littoral', 'West', 'North-West', 'South-West', 'North', 'Far North', 'Adamawa', 'East', 'South'],
    districts: [['Yaoundé', 'Centre', true], ['Douala', 'Littoral', true], ['Bafoussam', 'West'], ['Garoua', 'North']],
  },
  {
    code: 'CF',
    regions: ['Ombella-M\'Poko', 'Lobaye', 'Sangha-Mbaéré', 'Mambéré-Kadéï', 'Nana-Mambéré', 'Ouham-Pendé', 'Ouham', 'Nana-Grébizi', 'Kémo', 'Ouaka', 'Haute-Kotto', 'Bamingui-Bangoran', 'Vakaga', 'Haut-Mbomou', 'Mbomou'],
    districts: [['Bangui', 'Ombella-M\'Poko', true], ['Berbérati', 'Mambéré-Kadéï'], ['Bouar', 'Nana-Mambéré']],
  },
  {
    code: 'TD',
    regions: ['N\'Djamena', 'Mayo-Kebbi Est', 'Mayo-Kebbi Ouest', 'Logone Occidental', 'Logone Oriental', 'Tandjilé', 'Moyen-Chari', 'Mandoul', 'Ouaddaï', 'Wadi Fira', 'Batha', 'Guéra', 'Salamat', 'Chari-Baguirmi', 'Hadjer-Lamis', 'Lac', 'Kanem', 'Borkou', 'Ennedi Est', 'Ennedi Ouest', 'Tibesti', 'Sila', 'Barh El Gazel'],
    districts: [['N\'Djamena', 'N\'Djamena', true], ['Moundou', 'Logone Occidental', true], ['Sarh', 'Moyen-Chari']],
  },
  {
    code: 'KM',
    regions: ['Grande Comore', 'Anjouan', 'Mohéli'],
    districts: [['Moroni', 'Grande Comore', true], ['Mutsamudu', 'Anjouan'], ['Fomboni', 'Mohéli']],
  },
  {
    code: 'CG',
    regions: ['Brazzaville', 'Pointe-Noire', 'Kouilou', 'Niari', 'Lékoumou', 'Bouenza', 'Pool', 'Plateaux', 'Cuvette', 'Cuvette-Ouest', 'Sangha', 'Likouala'],
    districts: [['Brazzaville', 'Brazzaville', true], ['Pointe-Noire', 'Pointe-Noire', true]],
  },
  {
    code: 'CD',
    regions: ['Kinshasa', 'Kongo Central', 'Kwango', 'Kwilu', 'Mai-Ndombe', 'Équateur', 'Mongala', 'Nord-Ubangi', 'Sud-Ubangi', 'Tshuapa', 'Tshopo', 'Bas-Uélé', 'Haut-Uélé', 'Ituri', 'Nord-Kivu', 'Sud-Kivu', 'Maniema', 'Haut-Katanga', 'Haut-Lomami', 'Lualaba', 'Tanganyika', 'Kasaï', 'Kasaï-Central', 'Kasaï-Oriental', 'Lomami', 'Sankuru'],
    districts: [['Kinshasa', 'Kinshasa', true], ['Lubumbashi', 'Haut-Katanga', true], ['Goma', 'Nord-Kivu', true], ['Kisangani', 'Tshopo'], ['Mbuji-Mayi', 'Kasaï-Oriental']],
  },
  {
    code: 'CI',
    regions: ['Abidjan', 'Yamoussoukro', 'Bas-Sassandra', 'Comoé', 'Denguélé', 'Gôh-Djiboua', 'Lacs', 'Lagunes', 'Montagnes', 'Sassandra-Marahoué', 'Savanes', 'Vallée du Bandama', 'Woroba', 'Zanzan'],
    districts: [['Abidjan', 'Abidjan', true], ['Yamoussoukro', 'Yamoussoukro', true], ['Bouaké', 'Vallée du Bandama', true], ['San-Pédro', 'Bas-Sassandra']],
  },
  {
    code: 'DJ',
    regions: ['Djibouti', 'Ali Sabieh', 'Dikhil', 'Tadjourah', 'Obock', 'Arta'],
    districts: [['Djibouti City', 'Djibouti', true], ['Ali Sabieh', 'Ali Sabieh']],
  },
  {
    code: 'EG',
    regions: ['Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Port Said', 'Suez', 'Dakahlia', 'Sharqia', 'Gharbia', 'Monufia', 'Beheira', 'Kafr El Sheikh', 'Damietta', 'Ismailia', 'Minya', 'Beni Suef', 'Fayoum', 'Asyut', 'Sohag', 'Qena', 'Luxor', 'Aswan', 'Red Sea', 'New Valley', 'Matrouh', 'North Sinai', 'South Sinai'],
    districts: [['Cairo', 'Cairo', true], ['Alexandria', 'Alexandria', true], ['Giza', 'Giza', true], ['Sharm El Sheikh', 'South Sinai'], ['Luxor', 'Luxor']],
  },
  {
    code: 'GQ',
    regions: ['Bioko Norte', 'Bioko Sur', 'Litoral', 'Centro Sur', 'Kié-Ntem', 'Wele-Nzas', 'Annobón'],
    districts: [['Malabo', 'Bioko Norte', true], ['Bata', 'Litoral', true]],
  },
  {
    code: 'ER',
    regions: ['Maekel', 'Debub', 'Gash-Barka', 'Anseba', 'Semienawi Keyih Bahri', 'Debubawi Keyih Bahri'],
    districts: [['Asmara', 'Maekel', true], ['Keren', 'Anseba'], ['Massawa', 'Semienawi Keyih Bahri']],
  },
  {
    code: 'SZ',
    regions: ['Hhohho', 'Manzini', 'Lubombo', 'Shiselweni'],
    districts: [['Mbabane', 'Hhohho', true], ['Manzini', 'Manzini', true]],
  },
  {
    code: 'ET',
    regions: ['Addis Ababa', 'Dire Dawa', 'Oromia', 'Amhara', 'Tigray', 'Sidama', 'South West Ethiopia', 'Somali', 'Afar', 'Benishangul-Gumuz', 'Gambela', 'Harari', 'Central Ethiopia', 'South Ethiopia'],
    districts: [['Addis Ababa', 'Addis Ababa', true], ['Dire Dawa', 'Dire Dawa', true], ['Bahir Dar', 'Amhara'], ['Hawassa', 'Sidama'], ['Mekelle', 'Tigray']],
  },
  {
    code: 'GA',
    regions: ['Estuaire', 'Haut-Ogooué', 'Moyen-Ogooué', 'Ngounié', 'Nyanga', 'Ogooué-Ivindo', 'Ogooué-Lolo', 'Ogooué-Maritime', 'Woleu-Ntem'],
    districts: [['Libreville', 'Estuaire', true], ['Port-Gentil', 'Ogooué-Maritime', true], ['Franceville', 'Haut-Ogooué']],
  },
  {
    code: 'GM',
    regions: ['Banjul', 'Kanifing', 'West Coast', 'Lower River', 'North Bank', 'Central River', 'Upper River'],
    districts: [['Banjul', 'Banjul', true], ['Serekunda', 'Kanifing', true], ['Brikama', 'West Coast']],
  },
  {
    code: 'GH',
    regions: ['Greater Accra', 'Ashanti', 'Western', 'Western North', 'Central', 'Eastern', 'Volta', 'Oti', 'Northern', 'Savannah', 'North East', 'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo'],
    districts: [['Accra', 'Greater Accra', true], ['Kumasi', 'Ashanti', true], ['Tamale', 'Northern', true], ['Takoradi', 'Western'], ['Cape Coast', 'Central']],
  },
  {
    code: 'GN',
    regions: ['Conakry', 'Kindia', 'Boké', 'Mamou', 'Labé', 'Faranah', 'Kankan', 'Nzérékoré'],
    districts: [['Conakry', 'Conakry', true], ['Kankan', 'Kankan'], ['Nzérékoré', 'Nzérékoré'], ['Kindia', 'Kindia']],
  },
  {
    code: 'GW',
    regions: ['Bissau', 'Bafatá', 'Gabú', 'Bissorã', 'Bolama', 'Cacheu', 'Oio', 'Quinara', 'Tombali'],
    districts: [['Bissau', 'Bissau', true], ['Bafatá', 'Bafatá'], ['Gabú', 'Gabú']],
  },
  {
    code: 'LS',
    regions: ['Maseru', 'Berea', 'Leribe', 'Butha-Buthe', 'Mokhotlong', 'Thaba-Tseka', 'Qacha\'s Nek', 'Quthing', 'Mohale\'s Hoek', 'Mafeteng'],
    districts: [['Maseru', 'Maseru', true], ['Teyateyaneng', 'Berea'], ['Hlotse', 'Leribe']],
  },
  {
    code: 'LR',
    regions: ['Montserrado', 'Margibi', 'Bong', 'Nimba', 'Lofa', 'Grand Bassa', 'Grand Cape Mount', 'Sinoe', 'Grand Gedeh', 'Maryland', 'River Cess', 'Gbarpolu', 'Grand Kru', 'River Gee'],
    districts: [['Monrovia', 'Montserrado', true], ['Gbarnga', 'Bong'], ['Buchanan', 'Grand Bassa']],
  },
  {
    code: 'LY',
    regions: ['Tripoli', 'Benghazi', 'Misrata', 'Bayda', 'Zawiya', 'Zliten', 'Ajdabiya', 'Tobruk', 'Sabha', 'Derna', 'Sirte', 'Gharyan', 'Khoms', 'Jabal al Akhdar', 'Jabal al Gharbi', 'Jufra', 'Kufra', 'Marj', 'Murzuq', 'Nalut', 'Nuqat al Khams', 'Wadi al Hayaa', 'Wadi al Shatii'],
    districts: [['Tripoli', 'Tripoli', true], ['Benghazi', 'Benghazi', true], ['Misrata', 'Misrata', true], ['Sabha', 'Sabha']],
  },
  {
    code: 'MG',
    regions: ['Antananarivo', 'Toamasina', 'Fianarantsoa', 'Mahajanga', 'Toliara', 'Antsiranana'],
    districts: [['Antananarivo', 'Antananarivo', true], ['Toamasina', 'Toamasina', true], ['Mahajanga', 'Mahajanga'], ['Fianarantsoa', 'Fianarantsoa']],
  },
  {
    code: 'MW',
    regions: ['Northern', 'Central', 'Southern'],
    districts: [['Lilongwe', 'Central', true], ['Blantyre', 'Southern', true], ['Mzuzu', 'Northern']],
  },
  {
    code: 'ML',
    regions: ['Bamako', 'Kayes', 'Koulikoro', 'Sikasso', 'Ségou', 'Mopti', 'Tombouctou', 'Gao', 'Kidal', 'Taoudénit', 'Ménaka'],
    districts: [['Bamako', 'Bamako', true], ['Sikasso', 'Sikasso'], ['Mopti', 'Mopti'], ['Ségou', 'Ségou']],
  },
  {
    code: 'MR',
    regions: ['Nouakchott Nord', 'Nouakchott Ouest', 'Nouakchott Sud', 'Adrar', 'Assaba', 'Brakna', 'Dakhlet Nouadhibou', 'Gorgol', 'Guidimaka', 'Hodh Ech Chargui', 'Hodh El Gharbi', 'Inchiri', 'Tagant', 'Tiris Zemmour', 'Trarza'],
    districts: [['Nouakchott', 'Nouakchott Ouest', true], ['Nouadhibou', 'Dakhlet Nouadhibou', true]],
  },
  {
    code: 'MU',
    regions: ['Port Louis', 'Plaines Wilhems', 'Moka', 'Flacq', 'Grand Port', 'Savanne', 'Rivière Noire', 'Pamplemousses', 'Rivière du Rempart', 'Rodrigues'],
    districts: [['Port Louis', 'Port Louis', true], ['Beau Bassin-Rose Hill', 'Plaines Wilhems', true], ['Curepipe', 'Plaines Wilhems']],
  },
  {
    code: 'MA',
    regions: ['Casablanca-Settat', 'Rabat-Salé-Kénitra', 'Marrakech-Safi', 'Fès-Meknès', 'Tanger-Tétouan-Al Hoceïma', 'Oriental', 'Souss-Massa', 'Béni Mellal-Khénifra', 'Drâa-Tafilalet', 'Guelmim-Oued Noun', 'Laâyoune-Sakia El Hamra', 'Dakhla-Oued Ed-Dahab'],
    districts: [['Casablanca', 'Casablanca-Settat', true], ['Rabat', 'Rabat-Salé-Kénitra', true], ['Marrakech', 'Marrakech-Safi', true], ['Fès', 'Fès-Meknès', true], ['Tangier', 'Tanger-Tétouan-Al Hoceïma', true], ['Agadir', 'Souss-Massa']],
  },
  {
    code: 'MZ',
    regions: ['Maputo City', 'Maputo Province', 'Gaza', 'Inhambane', 'Sofala', 'Manica', 'Tete', 'Zambézia', 'Nampula', 'Niassa', 'Cabo Delgado'],
    districts: [['Maputo', 'Maputo City', true], ['Beira', 'Sofala', true], ['Nampula', 'Nampula'], ['Matola', 'Maputo Province']],
  },
  {
    code: 'NA',
    regions: ['Khomas', 'Erongo', 'Oshana', 'Ohangwena', 'Omusati', 'Oshikoto', 'Kavango East', 'Kavango West', 'Zambezi', 'Kunene', 'Otjozondjupa', 'Omaheke', 'Hardap', 'Karas'],
    districts: [['Windhoek', 'Khomas', true], ['Walvis Bay', 'Erongo', true], ['Swakopmund', 'Erongo'], ['Rundu', 'Kavango East']],
  },
  {
    code: 'NE',
    regions: ['Niamey', 'Agadez', 'Diffa', 'Dosso', 'Maradi', 'Tahoua', 'Tillabéri', 'Zinder'],
    districts: [['Niamey', 'Niamey', true], ['Zinder', 'Zinder', true], ['Maradi', 'Maradi']],
  },
  {
    code: 'NG',
    regions: ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'Federal Capital Territory'],
    districts: [['Lagos', 'Lagos', true], ['Abuja', 'Federal Capital Territory', true], ['Kano', 'Kano', true], ['Port Harcourt', 'Rivers', true], ['Ibadan', 'Oyo', true], ['Benin City', 'Edo'], ['Kaduna', 'Kaduna'], ['Enugu', 'Enugu']],
  },
  {
    code: 'RW',
    regions: ['Kigali', 'Northern', 'Southern', 'Eastern', 'Western'],
    districts: [['Kigali', 'Kigali', true], ['Huye', 'Southern'], ['Musanze', 'Northern'], ['Rubavu', 'Western']],
  },
  {
    code: 'ST',
    regions: ['São Tomé', 'Príncipe'],
    districts: [['São Tomé', 'São Tomé', true], ['Santo António', 'Príncipe']],
  },
  {
    code: 'SN',
    regions: ['Dakar', 'Thiès', 'Saint-Louis', 'Diourbel', 'Louga', 'Fatick', 'Kaolack', 'Kaffrine', 'Tambacounda', 'Kédougou', 'Kolda', 'Sédhiou', 'Ziguinchor', 'Matam'],
    districts: [['Dakar', 'Dakar', true], ['Thiès', 'Thiès', true], ['Saint-Louis', 'Saint-Louis'], ['Touba', 'Diourbel'], ['Ziguinchor', 'Ziguinchor']],
  },
  {
    code: 'SC',
    regions: ['Greater Victoria', 'Mahé', 'Praslin', 'La Digue'],
    districts: [['Victoria', 'Greater Victoria', true], ['Anse Royale', 'Mahé'], ['Baie Sainte Anne', 'Praslin']],
  },
  {
    code: 'SL',
    regions: ['Western Area', 'Northern', 'Southern', 'Eastern', 'North West'],
    districts: [['Freetown', 'Western Area', true], ['Bo', 'Southern', true], ['Kenema', 'Eastern'], ['Makeni', 'Northern']],
  },
  {
    code: 'SO',
    regions: ['Banaadir', 'Puntland', 'Somaliland', 'Jubaland', 'South West', 'Galmudug', 'Hirshabelle'],
    districts: [['Mogadishu', 'Banaadir', true], ['Hargeisa', 'Somaliland', true], ['Garowe', 'Puntland'], ['Kismayo', 'Jubaland'], ['Baidoa', 'South West']],
  },
  {
    code: 'ZA',
    regions: ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'],
    districts: [['Johannesburg', 'Gauteng', true], ['Cape Town', 'Western Cape', true], ['Durban', 'KwaZulu-Natal', true], ['Pretoria', 'Gauteng', true], ['Gqeberha', 'Eastern Cape', true], ['Bloemfontein', 'Free State']],
  },
  {
    code: 'SS',
    regions: ['Central Equatoria', 'Eastern Equatoria', 'Western Equatoria', 'Jonglei', 'Upper Nile', 'Unity', 'Lakes', 'Warrap', 'Northern Bahr el Ghazal', 'Western Bahr el Ghazal'],
    districts: [['Juba', 'Central Equatoria', true], ['Wau', 'Western Bahr el Ghazal'], ['Malakal', 'Upper Nile']],
  },
  {
    code: 'SD',
    regions: ['Khartoum', 'Gezira', 'River Nile', 'Northern', 'Kassala', 'Red Sea', 'North Darfur', 'South Darfur', 'West Darfur', 'Central Darfur', 'East Darfur', 'North Kordofan', 'South Kordofan', 'West Kordofan', 'Blue Nile', 'Sennar', 'White Nile'],
    districts: [['Khartoum', 'Khartoum', true], ['Omdurman', 'Khartoum', true], ['Port Sudan', 'Red Sea', true], ['Nyala', 'South Darfur'], ['Kassala', 'Kassala']],
  },
  {
    code: 'TZ',
    regions: ['Dar es Salaam', 'Dodoma', 'Arusha', 'Mwanza', 'Mbeya', 'Morogoro', 'Tanga', 'Kilimanjaro', 'Iringa', 'Mtwara', 'Kagera', 'Kigoma', 'Lindi', 'Manyara', 'Mara', 'Pwani', 'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora', 'Geita', 'Katavi', 'Njombe', 'Unguja', 'Pemba'],
    districts: [['Dar es Salaam', 'Dar es Salaam', true], ['Dodoma', 'Dodoma', true], ['Mwanza', 'Mwanza', true], ['Arusha', 'Arusha', true], ['Zanzibar City', 'Unguja', true], ['Mbeya', 'Mbeya']],
  },
  {
    code: 'TG',
    regions: ['Maritime', 'Plateaux', 'Centrale', 'Kara', 'Savanes'],
    districts: [['Lomé', 'Maritime', true], ['Sokodé', 'Centrale', true], ['Kara', 'Kara'], ['Kpalimé', 'Plateaux']],
  },
  {
    code: 'TN',
    regions: ['Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Sfax', 'Sousse', 'Monastir', 'Nabeul', 'Bizerte', 'Gabès', 'Gafsa', 'Kairouan', 'Kasserine', 'Kebili', 'Le Kef', 'Mahdia', 'Medenine', 'Sidi Bouzid', 'Siliana', 'Tataouine', 'Tozeur', 'Zaghouan', 'Jendouba', 'Béja'],
    districts: [['Tunis', 'Tunis', true], ['Sfax', 'Sfax', true], ['Sousse', 'Sousse', true], ['Bizerte', 'Bizerte'], ['Gabès', 'Gabès']],
  },
  {
    code: 'EH',
    regions: ['Laâyoune', 'Dakhla', 'Es-Semara', 'Boujdour', 'Aousserd', 'Oued Ed-Dahab'],
    districts: [['Laâyoune', 'Laâyoune', true], ['Dakhla', 'Dakhla', true]],
  },
  {
    code: 'ZM',
    regions: ['Lusaka', 'Copperbelt', 'Southern', 'Central', 'Eastern', 'Northern', 'Luapula', 'North-Western', 'Western', 'Muchinga'],
    districts: [['Lusaka', 'Lusaka', true], ['Kitwe', 'Copperbelt', true], ['Ndola', 'Copperbelt', true], ['Livingstone', 'Southern']],
  },
  {
    code: 'ZW',
    regions: ['Harare', 'Bulawayo', 'Manicaland', 'Mashonaland Central', 'Mashonaland East', 'Mashonaland West', 'Masvingo', 'Matabeleland North', 'Matabeleland South', 'Midlands'],
    districts: [['Harare', 'Harare', true], ['Bulawayo', 'Bulawayo', true], ['Mutare', 'Manicaland'], ['Gweru', 'Midlands'], ['Victoria Falls', 'Matabeleland North']],
  },
];