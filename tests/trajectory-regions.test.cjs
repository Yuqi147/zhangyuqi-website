// Run with: node tests/trajectory-regions.test.cjs
const assert = require('node:assert/strict');
require('../js/trajectory-regions.js');
const { contains, resolveStays } = globalThis.LifeTrajectoryRegions;
const ring = (w, s, e, n) => [[w,s],[e,s],[e,n],[w,n],[w,s]];
const polygon = (w,s,e,n) => ({type:'Polygon', coordinates:[ring(w,s,e,n)]});
const feature = (id, country, parent, bbox, name=id) => ({
  type:'Feature', properties:{id,country,parent,name}, bbox,
  geometry:polygon(...bbox)
});
const fc = features => ({type:'FeatureCollection',features});

const withHole = {type:'Polygon',coordinates:[ring(0,0,10,10),ring(3,3,7,7)]};
assert.equal(contains(withHole,[1,1]),true);
assert.equal(contains(withHole,[5,5]),false);
assert.equal(contains(withHole,[0,5]),true,'Outer boundary is included');
assert.equal(contains(withHole,[3,5]),true,'Hole boundary is included');
assert.equal(contains(withHole,[10,10]),true,'Vertex is included');
assert.equal(contains(withHole,[11,5]),false);
assert.equal(contains({type:'MultiPolygon',coordinates:[polygon(0,0,2,2).coordinates,polygon(10,10,12,12).coordinates]},[11,11]),true);
assert.equal(contains({type:'MultiPolygon',coordinates:[polygon(0,0,2,2).coordinates,polygon(10,10,12,12).coordinates]},[5,5]),false);
assert.equal(contains(polygon(170,-10,-170,10),[179,0]),true,'Eastern antimeridian edge');
assert.equal(contains(polygon(170,-10,-170,10),[-179,0]),true,'Western antimeridian edge');
assert.equal(contains(polygon(170,-10,-170,10),[0,0]),false,'Dateline polygon must not cover Greenwich');
assert.equal(contains(polygon(170,-10,-170,10),[180,0]),true);
assert.equal(contains(null,[0,0]),false);
assert.equal(contains(polygon(0,0,2,2),[NaN,1]),false);

const geography = {
  world:fc([
    feature('CHN','CN',null,[100,10,130,40],'China'),
    feature('USA','US',null,[-80,30,-60,50],'United States of America')
  ]),
  first:fc([
    feature('CN-1','CN','CN',[110,20,120,30],'Province One'),
    feature('US-1','US','US',[-75,35,-65,45],'State One')
  ]),
  second:fc([
    feature('CN-A','CN','CN-1',[112,22,114,24],'Same City'),
    feature('US-A','US','US-1',[-73,37,-71,39],'Same City')
  ])
};
const records = [
  Object.freeze({id:'cn',city:'Same City',region:'Province One',country:'China',longitude:113,latitude:23}),
  Object.freeze({id:'us',city:'Same City',region:'State One',country:'United States',longitude:-72,latitude:38})
];
const result = resolveStays(records, geography);
assert.deepEqual(result.stays.map(s => [s.region1,s.region2]),[['CN-1','CN-A'],['US-1','US-A']]);
assert.deepEqual(result.warnings,[]);
assert.notEqual(result.stays[0],records[0]);
assert.equal(records[0].region1,undefined,'Never mutate parsed CSV records');

const explicit = resolveStays([{...records[0],region1:'CN-1',region2:'CN-A'}],geography);
assert.equal(explicit.stays[0].region2,'CN-A');
assert.equal(explicit.warnings.length,0);
const wrong = resolveStays([{...records[1],region1:'CN-1',region2:'missing'}],geography);
assert.equal(wrong.stays[0].region1,'US-1');
assert.equal(wrong.stays[0].region2,'US-A');
assert.equal(wrong.warnings.length,2,'Bad optional IDs are reported and recovered through coordinates');

const outside = resolveStays([{...records[0],longitude:135,region1:'CN-1',region2:'CN-A'}],geography);
assert.equal(outside.stays[0].region1,undefined);
assert.equal(outside.stays[0].region2,undefined);
assert.equal(outside.stays[0].longitude,135,'Keep coordinates for the precise layer');
assert.ok(outside.warnings.some(w => w.includes('first-level administrative outline is unavailable')));
const wrongCountry = resolveStays([{...records[1],country:'China'}],geography);
assert.equal(wrongCountry.stays[0].region1,undefined,'A coordinate cannot silently override its country');
const unknownCountry = resolveStays([{...records[1],country:'Atlantis'}],geography);
assert.equal(unknownCountry.stays[0].region2,undefined);

const parentMismatch = {...geography,second:fc([feature('CN-B','CN','CN-other',[112,22,114,24])])};
assert.equal(resolveStays([records[0]],parentMismatch).stays[0].region2,undefined,'Honor known parent relationships');
const absentParent = {...geography,second:fc([feature('CN-B','CN',null,[112,22,114,24])])};
assert.equal(resolveStays([records[0]],absentParent).stays[0].region2,'CN-B','Unassigned parent can still resolve geometrically');
const missingLayer = resolveStays([records[0]],{...geography,second:fc([])});
assert.equal(missingLayer.stays[0].region1,'CN-1');
assert.equal(missingLayer.stays[0].region2,undefined);
assert.equal(missingLayer.warnings.length,1);
const withGlobalFirst = {...geography,firstBackground:fc([
  feature('CA-ON','CA','CA',[-90,40,-75,55],'Ontario'),
  feature('CN-1','CN','CN',[0,0,1,1],'Wrong duplicate outline')
])};
const canada = resolveStays([{id:'toronto',city:'Toronto',country:'Canada',region:'Ontario',longitude:-79.38,latitude:43.65}],withGlobalFirst);
assert.equal(canada.stays[0].region1,'CA-ON','Global first-level fallback supports new countries');
assert.equal(canada.stays[0].region2,undefined);
assert.equal(resolveStays([records[0]],withGlobalFirst).stays[0].region1,'CN-1','Detailed first-level source wins duplicate IDs');
assert.deepEqual(resolveStays([],geography),{stays:[],warnings:[]});
console.log('Trajectory region tests passed: polygons, holes, antimeridian, country matching, optional IDs, and unavailable outlines.');
