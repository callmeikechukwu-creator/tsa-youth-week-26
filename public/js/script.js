/* ============================================================
   IBCC YOUTH FELLOWSHIP — script.js
   The Salvation Army, Ibadan Central Corps
   ============================================================ */

/* ── Loader ── */
window.addEventListener('load', () => {
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('out');
    triggerReveal();
  }, 1600);
});

/* ── Navbar Scroll ── */
const nav = document.getElementById('nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

/* ── Hamburger / Drawer ── */
const hamburger     = document.getElementById('hamburger');
const drawer        = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerClose   = document.getElementById('drawerClose');

function openDrawer() {
  if (!hamburger || !drawer || !drawerOverlay) return;
  hamburger.classList.add('open');
  drawer.classList.add('open');
  drawerOverlay.style.display = 'block';
  setTimeout(() => drawerOverlay.classList.add('open'), 10);
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  if (!hamburger || !drawer || !drawerOverlay) return;
  hamburger.classList.remove('open');
  drawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  setTimeout(() => { drawerOverlay.style.display = 'none'; }, 300);
  document.body.style.overflow = '';
}

if (hamburger) hamburger.addEventListener('click', () => {
  drawer.classList.contains('open') ? closeDrawer() : openDrawer();
});
if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);
if (drawerClose)   drawerClose.addEventListener('click', closeDrawer);

/* ── Scroll Reveal ── */
function triggerReveal() {
  const els = document.querySelectorAll('.reveal:not(.in)');
  if (!els.length) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => io.observe(el));
}

window.addEventListener('DOMContentLoaded', triggerReveal);

/* ── Counter Animation ── */
function animateCounters() {
  document.querySelectorAll('.stat-n[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const dur    = 1800;
    const start  = performance.now();

    function step(now) {
      const t    = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(ease * target) + suffix;
      if (t < 1) requestAnimationFrame(step);
    }

    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        requestAnimationFrame(step);
        io.disconnect();
      }
    });
    io.observe(el);
  });
}
animateCounters();

/* ── Gallery Filters ── */
const filterBtns   = document.querySelectorAll('.filter-btn');
const galleryItems = document.querySelectorAll('.g-item');

if (filterBtns.length && galleryItems.length) {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      galleryItems.forEach(item => {
        item.classList.toggle('hidden', filter !== 'all' && item.dataset.cat !== filter);
      });
    });
  });
}

/* ── Gallery Lightbox ── */
const lightbox = document.getElementById('lightbox');
const lbClose  = document.getElementById('lbClose');

if (lightbox) {
  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const title = item.dataset.title || '';
      const desc  = item.dataset.desc  || '';
      const tag   = item.dataset.tag   || '';
      const img   = item.dataset.img   || '';

      document.getElementById('lbTitle').textContent = title;
      document.getElementById('lbDesc').textContent  = desc;
      document.getElementById('lbTag').textContent   = tag;

      const visual = document.getElementById('lbVisual');
      if (img) {
        visual.innerHTML = `<img src="${img}" alt="${title}" style="width:100%;height:100%;object-fit:cover;">`;
      } else {
        const bg = item.querySelector('.g-ph');
        visual.innerHTML = `
          <div style="width:100%;height:100%;background:linear-gradient(135deg,${getComputedStyle(bg || item).getPropertyValue('--c1') || '#333'},${getComputedStyle(bg || item).getPropertyValue('--c2') || '#111'});display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:40px;">
            <div style="opacity:.15;"><svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" fill="white" viewBox="0 0 16 16"><path d="M10.5 8.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0"/><path d="M2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4zm.5 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1m9 2.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0"/></svg></div>
            <p style="font-size:13px;color:rgba(255,255,255,.5);text-align:center;">Real photo coming soon</p>
          </div>`;
      }

      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });

  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }
}

/* ── FAQ Accordion ── */
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item   = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

/* ══════════════════════════════════════════════════════════
   INTERNATIONAL PHONE INPUT
   ══════════════════════════════════════════════════════════ */
var resetPhoneCountry;
(function initPhoneInput() {
  const phoneWrap = document.getElementById('phoneWrap');
  if (!phoneWrap) return;

  const btn      = document.getElementById('phoneCountryBtn');
  const dropdown = document.getElementById('phoneDropdown');
  const search   = document.getElementById('phoneSearch');
  const list     = document.getElementById('phoneList');
  const flagEl   = document.getElementById('phoneFlag');
  const codeEl   = document.getElementById('phoneCode');
  const input    = document.getElementById('c-phone');

  if (!btn || !dropdown || !search || !list || !flagEl || !codeEl || !input) return;

  const countries = [
    ['AF','Afghanistan','93'],['AL','Albania','355'],['DZ','Algeria','213'],
    ['AS','American Samoa','1684'],['AD','Andorra','376'],['AO','Angola','244'],
    ['AI','Anguilla','1264'],['AG','Antigua and Barbuda','1268'],['AR','Argentina','54'],
    ['AM','Armenia','374'],['AW','Aruba','297'],['AU','Australia','61'],
    ['AT','Austria','43'],['AZ','Azerbaijan','994'],
    ['BS','Bahamas','1242'],['BH','Bahrain','973'],['BD','Bangladesh','880'],
    ['BB','Barbados','1246'],['BY','Belarus','375'],['BE','Belgium','32'],
    ['BZ','Belize','501'],['BJ','Benin','229'],['BM','Bermuda','1441'],
    ['BT','Bhutan','975'],['BO','Bolivia','591'],['BA','Bosnia and Herzegovina','387'],
    ['BW','Botswana','267'],['BR','Brazil','55'],['IO','British Indian Ocean Territory','246'],
    ['BN','Brunei','673'],['BG','Bulgaria','359'],['BF','Burkina Faso','226'],
    ['BI','Burundi','257'],
    ['KH','Cambodia','855'],['CM','Cameroon','237'],['CA','Canada','1'],
    ['CV','Cape Verde','238'],['KY','Cayman Islands','1345'],['CF','Central African Republic','236'],
    ['TD','Chad','235'],['CL','Chile','56'],['CN','China','86'],
    ['CO','Colombia','57'],['KM','Comoros','269'],['CG','Congo','242'],
    ['CD','Congo (DRC)','243'],['CK','Cook Islands','682'],['CR','Costa Rica','506'],
    ['CI',"Côte d'Ivoire",'225'],['HR','Croatia','385'],['CU','Cuba','53'],
    ['CW','Curaçao','599'],['CY','Cyprus','357'],['CZ','Czech Republic','420'],
    ['DK','Denmark','45'],['DJ','Djibouti','253'],['DM','Dominica','1767'],
    ['DO','Dominican Republic','1809'],
    ['EC','Ecuador','593'],['EG','Egypt','20'],['SV','El Salvador','503'],
    ['GQ','Equatorial Guinea','240'],['ER','Eritrea','291'],['EE','Estonia','372'],
    ['SZ','Eswatini','268'],['ET','Ethiopia','251'],
    ['FK','Falkland Islands','500'],['FO','Faroe Islands','298'],['FJ','Fiji','679'],
    ['FI','Finland','358'],['FR','France','33'],['GF','French Guiana','594'],
    ['PF','French Polynesia','689'],
    ['GA','Gabon','241'],['GM','Gambia','220'],['GE','Georgia','995'],
    ['DE','Germany','49'],['GH','Ghana','233'],['GI','Gibraltar','350'],
    ['GR','Greece','30'],['GL','Greenland','299'],['GD','Grenada','1473'],
    ['GP','Guadeloupe','590'],['GU','Guam','1671'],['GT','Guatemala','502'],
    ['GG','Guernsey','44'],['GN','Guinea','224'],['GW','Guinea-Bissau','245'],
    ['GY','Guyana','592'],
    ['HT','Haiti','509'],['HN','Honduras','504'],['HK','Hong Kong','852'],
    ['HU','Hungary','36'],
    ['IS','Iceland','354'],['IN','India','91'],['ID','Indonesia','62'],
    ['IR','Iran','98'],['IQ','Iraq','964'],['IE','Ireland','353'],
    ['IM','Isle of Man','44'],['IL','Israel','972'],['IT','Italy','39'],
    ['JM','Jamaica','1876'],['JP','Japan','81'],['JE','Jersey','44'],
    ['JO','Jordan','962'],
    ['KZ','Kazakhstan','7'],['KE','Kenya','254'],['KI','Kiribati','686'],
    ['KP','North Korea','850'],['KR','South Korea','82'],
    ['XK','Kosovo','383'],['KW','Kuwait','965'],['KG','Kyrgyzstan','996'],
    ['LA','Laos','856'],['LV','Latvia','371'],['LB','Lebanon','961'],
    ['LS','Lesotho','266'],['LR','Liberia','231'],['LY','Libya','218'],
    ['LI','Liechtenstein','423'],['LT','Lithuania','370'],['LU','Luxembourg','352'],
    ['MO','Macau','853'],['MK','North Macedonia','389'],['MG','Madagascar','261'],
    ['MW','Malawi','265'],['MY','Malaysia','60'],['MV','Maldives','960'],
    ['ML','Mali','223'],['MT','Malta','356'],['MH','Marshall Islands','692'],
    ['MQ','Martinique','596'],['MR','Mauritania','222'],['MU','Mauritius','230'],
    ['YT','Mayotte','262'],['MX','Mexico','52'],['FM','Micronesia','691'],
    ['MD','Moldova','373'],['MC','Monaco','377'],['MN','Mongolia','976'],
    ['ME','Montenegro','382'],['MS','Montserrat','1664'],['MA','Morocco','212'],
    ['MZ','Mozambique','258'],['MM','Myanmar','95'],
    ['NA','Namibia','264'],['NR','Nauru','674'],['NP','Nepal','977'],
    ['NL','Netherlands','31'],['NC','New Caledonia','687'],['NZ','New Zealand','64'],
    ['NI','Nicaragua','505'],['NE','Niger','227'],['NG','Nigeria','234'],
    ['NU','Niue','683'],['NF','Norfolk Island','672'],['NO','Norway','47'],
    ['OM','Oman','968'],
    ['PK','Pakistan','92'],['PW','Palau','680'],['PS','Palestine','970'],
    ['PA','Panama','507'],['PG','Papua New Guinea','675'],['PY','Paraguay','595'],
    ['PE','Peru','51'],['PH','Philippines','63'],['PL','Poland','48'],
    ['PT','Portugal','351'],['PR','Puerto Rico','1787'],
    ['QA','Qatar','974'],
    ['RE','Réunion','262'],['RO','Romania','40'],['RU','Russia','7'],
    ['RW','Rwanda','250'],
    ['KN','Saint Kitts and Nevis','1869'],['LC','Saint Lucia','1758'],
    ['PM','Saint Pierre and Miquelon','508'],['VC','Saint Vincent','1784'],
    ['WS','Samoa','685'],['SM','San Marino','378'],['ST','São Tomé and Príncipe','239'],
    ['SA','Saudi Arabia','966'],['SN','Senegal','221'],['RS','Serbia','381'],
    ['SC','Seychelles','248'],['SL','Sierra Leone','232'],['SG','Singapore','65'],
    ['SX','Sint Maarten','1721'],['SK','Slovakia','421'],['SI','Slovenia','386'],
    ['SB','Solomon Islands','677'],['SO','Somalia','252'],['ZA','South Africa','27'],
    ['SS','South Sudan','211'],['ES','Spain','34'],['LK','Sri Lanka','94'],
    ['SD','Sudan','249'],['SR','Suriname','597'],['SE','Sweden','46'],
    ['CH','Switzerland','41'],['SY','Syria','963'],
    ['TW','Taiwan','886'],['TJ','Tajikistan','992'],['TZ','Tanzania','255'],
    ['TH','Thailand','66'],['TL','Timor-Leste','670'],['TG','Togo','228'],
    ['TK','Tokelau','690'],['TO','Tonga','676'],['TT','Trinidad and Tobago','1868'],
    ['TN','Tunisia','216'],['TR','Turkey','90'],['TM','Turkmenistan','993'],
    ['TC','Turks and Caicos','1649'],['TV','Tuvalu','688'],
    ['UG','Uganda','256'],['UA','Ukraine','380'],['AE','United Arab Emirates','971'],
    ['GB','United Kingdom','44'],['US','United States','1'],['UY','Uruguay','598'],
    ['UZ','Uzbekistan','998'],
    ['VU','Vanuatu','678'],['VA','Vatican City','379'],['VE','Venezuela','58'],
    ['VN','Vietnam','84'],['VG','British Virgin Islands','1284'],
    ['VI','US Virgin Islands','1340'],
    ['YE','Yemen','967'],
    ['ZM','Zambia','260'],['ZW','Zimbabwe','263']
  ];

  const defaultIso = 'NG';

  function flagImg(iso) {
    return '<img src="https://flagcdn.com/w40/' + iso.toLowerCase() + '.png" width="20" height="15" alt="' + iso + '" loading="lazy">';
  }

  let selected = countries.find(c => c[0] === defaultIso);

  function setCountry(country, focusInput) {
    selected = country;
    flagEl.innerHTML = flagImg(country[0]);
    codeEl.textContent = '+' + country[2];
    closeDropdown();
    if (focusInput) input.focus();
  }

  function renderList(filter) {
    var q    = (filter || '').toLowerCase();
    var html = '';
    for (var i = 0; i < countries.length; i++) {
      var c = countries[i];
      if (q && c[1].toLowerCase().indexOf(q) === -1 &&
               ('+' + c[2]).indexOf(q) === -1 &&
               c[0].toLowerCase().indexOf(q) === -1) continue;
      var sel = c[0] === selected[0] ? ' selected' : '';
      html += '<div class="phone-list-item' + sel + '" data-iso="' + c[0] + '">'
        + '<span class="pli-flag">' + flagImg(c[0]) + '</span>'
        + '<span class="pli-name">' + c[1] + '</span>'
        + '<span class="pli-code">+' + c[2] + '</span>'
        + '</div>';
    }
    list.innerHTML = html;
  }

  function openDropdown() {
    dropdown.classList.add('open');
    btn.classList.add('open');
    search.value = '';
    renderList('');
    setTimeout(function() {
      search.focus();
      var sel = list.querySelector('.selected');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
    }, 10);
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
    btn.classList.remove('open');
  }

  setCountry(selected);

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.contains('open') ? closeDropdown() : openDropdown();
  });

  search.addEventListener('input', function() { renderList(search.value); });

  list.addEventListener('click', function(e) {
    var item = e.target.closest('.phone-list-item');
    if (!item) return;
    var country = countries.find(c => c[0] === item.dataset.iso);
    if (country) setCountry(country, true);
  });

  document.addEventListener('click', function(e) {
    if (!phoneWrap.contains(e.target)) closeDropdown();
  });

  search.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeDropdown();
  });

  var phoneFormats = {
    'NG': [10, [3,3,4], '801 234 5678'],
    'US': [10, [3,3,4], '201 555 0123'],
    'CA': [10, [3,3,4], '204 555 0123'],
    'GB': [10, [4,3,3], '7911 123 456'],
    'GH': [9,  [2,3,4], '24 123 4567'],
    'ZA': [9,  [2,3,4], '71 123 4567'],
    'KE': [9,  [3,3,3], '712 345 678'],
    'IN': [10, [5,5],   '98765 43210'],
    'DE': [11, [3,4,4], '151 1234 5678'],
    'FR': [9,  [1,2,2,2,2], '6 12 34 56 78'],
    'IT': [10, [3,3,4], '312 345 6789'],
    'ES': [9,  [3,3,3], '612 345 678'],
    'PT': [9,  [3,3,3], '912 345 678'],
    'NL': [9,  [1,4,4], '6 1234 5678'],
    'BE': [9,  [3,2,2,2], '470 12 34 56'],
    'CH': [9,  [2,3,2,2], '78 123 45 67'],
    'AT': [10, [3,3,4], '664 123 4567'],
    'SE': [9,  [2,3,2,2], '70 123 45 67'],
    'NO': [8,  [3,2,3], '412 34 567'],
    'DK': [8,  [2,2,2,2], '20 12 34 56'],
    'FI': [10, [2,3,2,3], '50 123 45 678'],
    'PL': [9,  [3,3,3], '512 345 678'],
    'RO': [9,  [3,3,3], '712 345 678'],
    'CZ': [9,  [3,3,3], '601 123 456'],
    'HU': [9,  [2,3,4], '20 123 4567'],
    'GR': [10, [3,3,4], '691 234 5678'],
    'TR': [10, [3,3,2,2], '532 123 45 67'],
    'RU': [10, [3,3,2,2], '912 345 67 89'],
    'UA': [9,  [2,3,2,2], '50 123 45 67'],
    'BR': [11, [2,5,4], '11 91234 5678'],
    'MX': [10, [2,4,4], '55 1234 5678'],
    'AR': [10, [2,4,4], '11 1234 5678'],
    'CO': [10, [3,3,4], '301 234 5678'],
    'CL': [9,  [1,4,4], '9 1234 5678'],
    'PE': [9,  [3,3,3], '912 345 678'],
    'VE': [10, [3,3,4], '412 123 4567'],
    'AU': [9,  [3,3,3], '412 345 678'],
    'NZ': [9,  [3,3,3], '211 234 567'],
    'JP': [10, [2,4,4], '90 1234 5678'],
    'KR': [10, [2,4,4], '10 1234 5678'],
    'CN': [11, [3,4,4], '131 1234 5678'],
    'PH': [10, [3,3,4], '917 123 4567'],
    'ID': [11, [3,4,4], '812 1234 5678'],
    'MY': [10, [2,4,4], '12 1234 5678'],
    'SG': [8,  [4,4],   '9123 4567'],
    'TH': [9,  [2,3,4], '81 234 5678'],
    'VN': [10, [2,4,4], '91 1234 5678'],
    'PK': [10, [3,3,4], '301 234 5678'],
    'BD': [10, [4,3,3], '1812 345 678'],
    'LK': [9,  [2,3,4], '71 234 5678'],
    'SA': [9,  [2,3,4], '50 123 4567'],
    'AE': [9,  [2,3,4], '50 123 4567'],
    'EG': [10, [2,4,4], '10 1234 5678'],
    'MA': [9,  [3,3,3], '612 345 678'],
    'DZ': [9,  [3,3,3], '551 234 567'],
    'TN': [8,  [2,3,3], '20 123 456'],
    'CM': [9,  [3,3,3], '671 234 567'],
    'CI': [10, [2,2,2,2,2], '07 08 09 10 11'],
    'SN': [9,  [2,3,2,2], '70 123 45 67'],
    'TZ': [9,  [3,3,3], '712 345 678'],
    'UG': [9,  [3,3,3], '712 345 678'],
    'RW': [9,  [3,3,3], '781 234 567'],
    'ET': [9,  [2,3,4], '91 123 4567'],
    'ZM': [9,  [2,3,4], '95 123 4567'],
    'ZW': [9,  [2,3,4], '71 234 5678'],
    'BW': [8,  [2,3,3], '71 234 567'],
    'NA': [9,  [2,3,4], '81 234 5678'],
    'MZ': [9,  [2,3,4], '84 123 4567'],
    'AO': [9,  [3,3,3], '923 123 456'],
    'IL': [9,  [2,3,4], '50 123 4567'],
    'JO': [9,  [1,4,4], '7 9012 3456'],
    'LB': [8,  [1,3,4], '3 123 4567'],
    'IQ': [10, [3,3,4], '750 123 4567'],
    'IR': [10, [3,3,4], '912 345 6789'],
    'KW': [8,  [4,4],   '5000 1234'],
    'QA': [8,  [4,4],   '3312 3456'],
    'BH': [8,  [4,4],   '3600 1234'],
    'OM': [8,  [4,4],   '9212 3456'],
    'IE': [9,  [2,3,4], '85 012 3456'],
    'HK': [8,  [4,4],   '5123 4567'],
    'TW': [9,  [3,3,3], '912 345 678'],
    'AF': [9,  [2,3,4], '70 123 4567'],
    'MM': [10, [2,4,4], '92 1234 5678'],
    'KH': [9,  [2,3,4], '91 234 5678'],
    'NP': [10, [3,3,4], '984 123 4567'],
    'AM': [8,  [2,3,3], '77 123 456'],
    'GE': [9,  [3,3,3], '555 123 456'],
    'AZ': [9,  [2,3,2,2], '50 123 45 67'],
    'KZ': [10, [3,3,2,2], '701 123 45 67'],
    'UZ': [9,  [2,3,2,2], '90 123 45 67'],
    'BY': [10, [2,3,2,3], '29 123 45 678'],
    'LT': [8,  [3,2,3], '612 34 567'],
    'LV': [8,  [3,2,3], '212 34 567'],
    'EE': [8,  [3,2,3], '512 34 567'],
    'HR': [9,  [2,3,4], '91 234 5678'],
    'BA': [8,  [2,3,3], '61 234 567'],
    'RS': [9,  [2,3,4], '60 123 4567'],
    'SK': [9,  [3,3,3], '912 123 456'],
    'SI': [8,  [2,3,3], '31 234 567'],
    'BG': [9,  [3,3,3], '888 123 456'],
    'AL': [9,  [2,3,4], '66 123 4567'],
    'MK': [8,  [2,3,3], '72 345 678'],
    'ME': [8,  [2,3,3], '67 123 456'],
    'CY': [8,  [2,3,3], '96 123 456'],
    'MT': [8,  [4,4],   '9922 1234'],
    'IS': [7,  [3,4],   '611 1234'],
    'LU': [9,  [3,3,3], '621 123 456'],
    'LI': [7,  [3,2,2], '660 12 34'],
    'MC': [8,  [2,2,2,2], '61 23 45 67'],
    'AD': [6,  [3,3],   '312 345'],
    'DO': [10, [3,3,4], '809 234 5678'],
    'JM': [10, [3,3,4], '876 234 5678'],
    'TT': [10, [3,3,4], '868 234 5678'],
    'CR': [8,  [4,4],   '8312 3456'],
    'PA': [8,  [4,4],   '6123 4567'],
    'GT': [8,  [4,4],   '5123 4567'],
    'HN': [8,  [4,4],   '9123 4567'],
    'SV': [8,  [4,4],   '7012 3456'],
    'NI': [8,  [4,4],   '8123 4567'],
    'BZ': [7,  [3,4],   '622 1234'],
    'PY': [9,  [3,3,3], '961 456 789'],
    'UY': [8,  [3,2,3], '942 34 567'],
    'BO': [8,  [4,4],   '7012 3456'],
    'EC': [9,  [2,3,4], '99 123 4567'],
    'HT': [8,  [4,4],   '3412 3456'],
    'CU': [8,  [4,4],   '5123 4567'],
    'SO': [8,  [1,3,4], '6 123 4567'],
    'SS': [9,  [2,3,4], '97 123 4567'],
    'SD': [9,  [2,3,4], '91 123 4567'],
    'LR': [8,  [3,3,2], '886 123 45'],
    'SL': [8,  [2,3,3], '25 123 456'],
    'GN': [9,  [3,2,2,2], '622 12 34 56'],
    'ML': [8,  [2,2,2,2], '65 12 34 56'],
    'BF': [8,  [2,2,2,2], '70 12 34 56'],
    'NE': [8,  [2,2,2,2], '93 12 34 56'],
    'TD': [8,  [2,2,2,2], '63 12 34 56'],
    'BJ': [8,  [2,2,2,2], '97 12 34 56'],
    'TG': [8,  [2,2,2,2], '90 12 34 56'],
    'GA': [7,  [1,2,2,2], '6 21 23 45'],
    'CG': [9,  [2,3,4], '06 123 4567'],
    'CD': [9,  [3,3,3], '991 234 567'],
    'BI': [8,  [2,2,2,2], '79 12 34 56'],
    'MG': [9,  [2,2,3,2], '32 12 345 67'],
    'MW': [9,  [1,4,4], '9 8888 1234'],
    'MU': [8,  [4,4],   '5251 2345'],
    'SC': [7,  [1,2,2,2], '2 51 23 45'],
    'CV': [7,  [3,2,2], '991 12 34'],
    'GW': [7,  [3,4],   '955 1234'],
    'GM': [7,  [3,4],   '301 2345'],
    'CF': [8,  [2,2,2,2], '70 12 34 56'],
    'GQ': [9,  [3,3,3], '222 123 456'],
    'ER': [7,  [1,3,3], '7 123 456'],
    'DJ': [8,  [2,2,2,2], '77 12 34 56'],
    'KM': [7,  [3,2,2], '321 23 45'],
    'FJ': [7,  [3,4],   '701 2345'],
    'SR': [7,  [3,4],   '741 2345'],
    'GY': [7,  [3,4],   '609 1234'],
    'MV': [7,  [3,4],   '771 2345'],
    'BN': [7,  [3,4],   '712 3456'],
    'BT': [8,  [2,3,3], '17 123 456'],
    'MN': [8,  [4,4],   '8812 3456'],
    'LA': [10, [2,4,4], '20 1234 5678'],
    'TL': [8,  [4,4],   '7712 3456'],
    'KG': [9,  [3,3,3], '700 123 456'],
    'TJ': [9,  [3,3,3], '917 123 456'],
    'TM': [8,  [2,3,3], '66 123 456'],
    'MR': [8,  [2,2,2,2], '22 12 34 56'],
    'SZ': [8,  [4,4],   '7612 3456'],
    'LS': [8,  [4,4],   '5012 3456'],
    'LY': [10, [2,4,4], '91 1234 5678'],
    'VU': [7,  [3,4],   '591 2345'],
    'PG': [8,  [4,4],   '7012 3456'],
    'TO': [5,  [2,3],   '84 012'],
    'WS': [7,  [2,5],   '72 12345']
  };

  function getFormat()      { return phoneFormats[selected[0]] || null; }
  function getMaxDigits()   { var f = getFormat(); return f ? f[0] : 12; }
  function getGroups()      { var f = getFormat(); return f ? f[1] : null; }
  function getPlaceholder() { var f = getFormat(); return f ? f[2] : ''; }

  function formatPhone(digits, maxLen) {
    if (!digits) return '';
    digits = digits.substring(0, maxLen);
    var groups = getGroups();
    if (!groups) {
      if      (maxLen <= 7)  groups = [3, 4];
      else if (maxLen === 8) groups = [4, 4];
      else if (maxLen === 9) groups = [3, 3, 3];
      else if (maxLen === 10)groups = [3, 3, 4];
      else                   groups = [3, 4, 4];
    }
    var result = '', pos = 0;
    for (var i = 0; i < groups.length && pos < digits.length; i++) {
      if (i > 0) result += ' ';
      result += digits.substring(pos, pos + groups[i]);
      pos += groups[i];
    }
    return result;
  }

  input.addEventListener('input', function() {
    var cursorPos    = input.selectionStart;
    var beforeCursor = input.value.substring(0, cursorPos);
    var digitsBefore = beforeCursor.replace(/\D/g, '').length;

    var raw = input.value.replace(/\D/g, '');
    while (raw.charAt(0) === '0') {
      raw = raw.substring(1);
      if (digitsBefore > 0) digitsBefore--;
    }
    var max = getMaxDigits();
    if (raw.length > max) raw = raw.substring(0, max);
    if (digitsBefore > raw.length) digitsBefore = raw.length;

    var formatted = formatPhone(raw, max);
    input.value = formatted;

    var newPos = 0, count = 0;
    for (var i = 0; i < formatted.length && count < digitsBefore; i++) {
      if (/\d/.test(formatted[i])) count++;
      newPos = i + 1;
    }
    input.setSelectionRange(newPos, newPos);
  });

  var origSetCountry = setCountry;
  setCountry = function(country) {
    origSetCountry(country);
    input.placeholder = getPlaceholder() || '';
    if (input.value) {
      var raw = input.value.replace(/\D/g, '');
      while (raw.charAt(0) === '0') raw = raw.substring(1);
      var max = getMaxDigits();
      if (raw.length > max) raw = raw.substring(0, max);
      input.value = formatPhone(raw, max);
    }
  };

  input.placeholder = getPlaceholder() || '';

  resetPhoneCountry = function() {
    selected = countries.find(c => c[0] === defaultIso);
    flagEl.innerHTML   = flagImg(selected[0]);
    codeEl.textContent = '+' + selected[2];
    input.placeholder  = getPlaceholder() || '';
    closeDropdown();
  };
})();

/* ══════════════════════════════════════════════════════════
   CUSTOM SUBJECT DROPDOWN
   ══════════════════════════════════════════════════════════ */
var resetSubject;
(function initSubjectDropdown() {
  var wrap = document.getElementById('subjectWrap');
  if (!wrap) return;

  var btn       = document.getElementById('subjectBtn');
  var textEl    = document.getElementById('subjectText');
  var dropdown  = document.getElementById('subjectDropdown');
  var hidden    = document.getElementById('c-subject');
  var otherWrap = document.getElementById('subjectOtherWrap');
  var options   = dropdown.querySelectorAll('.subject-option');

  function open()  { dropdown.classList.add('open');    btn.classList.add('open'); }
  function close() { dropdown.classList.remove('open'); btn.classList.remove('open'); }

  function select(value) {
    if (hidden) hidden.value = value;
    if (value) {
      textEl.textContent = value;
      textEl.classList.remove('placeholder');
    } else {
      textEl.textContent = 'Select a topic...';
      textEl.classList.add('placeholder');
    }
    options.forEach(opt => opt.classList.toggle('selected', opt.dataset.value === value));
    close();

    if (value === 'Other') {
      if (otherWrap) otherWrap.style.display = '';
      var otherInput = document.getElementById('c-subject-other');
      if (otherInput) setTimeout(() => otherInput.focus(), 50);
    } else {
      if (otherWrap) otherWrap.style.display = 'none';
      var otherInput2 = document.getElementById('c-subject-other');
      if (otherInput2) otherInput2.value = '';
    }
  }

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.contains('open') ? close() : open();
  });

  options.forEach(opt => opt.addEventListener('click', () => select(opt.dataset.value)));

  document.addEventListener('click', function(e) {
    if (!wrap.contains(e.target)) close();
  });

  resetSubject = function() { select(''); };
})();