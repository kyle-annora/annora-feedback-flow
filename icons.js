(() => {
const paths={
 menu:'M3 6h18M3 12h18M3 18h18',sidebar:'M3 5h18v14H3zM9 5v14', inbox:'M4 5h16l2 10v4H2v-4zM2 14h6l2 3h4l2-3h6', feedback:'M4 4h16v12h-9l-5 4v-4H4zM8 8h8m-8 4h5',
 search:'M16 16l4.5 4.5M10.5 4a6.5 6.5 0 1 0 .01 0z',plus:'M12 5v14M5 12h14',edit:'m14.5 5.5 4 4M4 20l4.8-1.1L20 7.7c.5-.5.5-1.2 0-1.7L18 4c-.5-.5-1.2-.5-1.7 0L5 15.2z',
 play:'M8 5.5 18.5 12 8 18.5z',pause:'M8.5 5v14m7-14v14',next:'m9 5 7 7-7 7',back:'m15 5-7 7 7 7',down:'m7 10 5 5 5-5',send:'M4 12h15m-6-6 6 6-6 6',cross:'m6 6 12 12M18 6 6 18',check:'m5 12 4.5 4.5L19 7',checks:'m2 12 4 4L16 6m-4 8 2 2 8-8',
 globe:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2c6 5 6 15 0 20-6-5-6-15 0-20z', file:'M5 3h9l5 5v13H5zM14 3v6h5M8.5 13h7m-7 3.5h5',branch:'M6 3v11a4 4 0 0 0 4 4h7M6 11h6a5 5 0 0 0 5-5m-3 9 3 3-3 3', rulers:'m3 15 12-12 6 6L9 21zm10-10 2.3 2.3m-5.3.7 1.6 1.6m-4.6 1.4 2.3 2.3', target:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M12 8a4 4 0 1 0 .1 0z',
 clock:'M12 3a9 9 0 1 0 .1 0zM12 7v5l3.5 2', history:'M3 11a9 9 0 1 1 1.2 5M3 5v6h6m3-4v5l3 2',
 ask:'M4 4h16v13h-9l-4 3v-3H4zM10 8a2.2 2.2 0 1 1 3 2c-1 .4-1 1-1 2m0 2h.01', verify:'M12 3 4 6v5c0 5 4.8 8.5 8 10 3.2-1.5 8-5 8-10V6zM8.5 12l2.3 2.3 4.8-5', external:'M14 4h6v6m-9 3 9-9M11 6H4v14h14v-7',
 people:'M10 4a3 3 0 1 0 .1 0zM3 20v-2c0-4 3.3-5.5 7-5.5 3.7 0 7 1.5 7 5.5v2m-1-15a3 3 0 0 1 0 6m2 2c2.8.6 3.8 2.5 3.8 5v2',customer:'M12 3a3.5 3.5 0 1 0 .1 0zM4 21v-3c0-3.8 3.7-6 8-6s8 2.2 8 6v3', flag:'M5 21V3c5-3 9 3 15 0v11c-6 3-10-3-15 0', hand:'m8 12 2 2 5-5m-9 9 6 3 7-3 2-6-2-5-5-4-6 1-5 4-1 6z',release:'M4 14v5h16v-5M12 15V3m-5 5 5-5 5 5',
 hold:'M12 3a9 9 0 1 0 .01 0zM12 7v6m0 3h.01',quote:'M10 7H4v6h3c0 2-1 3-3 4m15-10h-6v6h3c0 2-1 3-3 4',lines:'M4 6h16M4 12h12M4 18h9',chip:'M6 6h12v12H6zm3-4v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',source:'M5 5h14v14H5zM8 9h8m-8 3h5',replay:'M4 10a8 8 0 1 1 .6 7M4 4v6h6', attach:'m9 13 6-6a2 2 0 0 1 3 3l-8 8a4 4 0 0 1-6-6l9-9',folder:'M3 6h7l2 2h9v12H3z', dots:'M4 12h.05m7.95 0h.05m7.95 0h.05',filter:'M3 6h18m-14 6h10m-7 6h4',keyboard:'M2 5h20v14H2zM5 9h.1m3.3 0h.1m3.3 0h.1m3.3 0h.1m3.3 0h.1M7 15h10',leaf:'M4 16c1-7 6-11 15-11 0 9-4 14-11 14-2 0-4-1-4-3zM5 19l9-9'
};
window.Glyph=(name,size=16)=>'<svg aria-hidden="true" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="'+(paths[name]||paths.file)+'"/></svg>';
})();
