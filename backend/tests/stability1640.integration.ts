/** Regresiones v1.64.0. Ejecutar solo con DATABASE_URL de una base fiix_cmms_test_* vacía. */
import assert from 'node:assert/strict';
import { Client } from 'pg';
import prisma from '../src/config/prisma';
import { isPrivateIp, pinnedLookup, isImageContentType } from '../src/utils/imageProxySafety';
import { recordDevPasswordFailure, getDevPasswordGateStatus } from '../src/utils/devPasswordGate';
import { updateMyPreferences } from '../src/controllers/userController';
import { tryStartImportJob, endImportJob, getSharedMaintenanceState } from '../src/utils/maintenance';
import { processCsvImportFiles } from '../src/utils/runCsvImport';
import { updatePurchaseOrderStatus } from '../src/controllers/purchaseOrderController';
import { getItems } from '../src/controllers/inventoryController';
import { getKPIs } from '../src/controllers/kpiController';
function response() {
 const r:any={code:200,body:null}; r.status=(n:number)=>{r.code=n;return r};r.json=(b:any)=>{r.body=b;return r};return r;
}
async function main() {
 assert.ok(process.env.DATABASE_URL?.includes('fiix_cmms_test_'));
 for(const ip of ['::ffff:127.0.0.1','::ffff:7f00:1','0:0:0:0:0:ffff:a00:1','2002:7f00:1::','64:ff9b::7f00:1','2001:db8::1']) assert.ok(isPrivateIp(ip),ip);
 assert.equal(isPrivateIp('2606:4700:4700::1111'),false);
 assert.equal(isImageContentType('image/svg+xml'),false);
 await new Promise<void>((resolve,reject)=>(pinnedLookup([{address:'8.8.8.8',family:4}]) as any)('host-that-changes.test',{all:true},(e:any,a:any)=>{try{assert.equal(e,null);assert.deepEqual(a,[{address:'8.8.8.8',family:4}]);resolve()}catch(e){reject(e)}}));
 console.log('✓ IPv6 encapsulada bloqueada y conexión fijada a la IP validada');
 const admin=await prisma.user.create({data:{name:'Admin',email:'regression@test.local',password_hash:'x',role:'ADMINISTRADOR'}});
 await Promise.all([recordDevPasswordFailure(admin.id),recordDevPasswordFailure(admin.id),recordDevPasswordFailure(admin.id),updateMyPreferences({user:{userId:admin.id},body:{preferences:{theme:'dark',dev_menu_lock:{failedAttempts:0}}}} as any,response())]);
 const gate=await getDevPasswordGateStatus(admin.id); assert.equal(gate.locked,true);assert.equal(gate.failedAttempts,3);
 console.log('✓ Fallos concurrentes y preferencias no borran el bloqueo de desarrollador');
 const other=new Client({connectionString:process.env.DATABASE_URL}); await other.connect();
 try {
  await other.query('SELECT pg_advisory_lock(16310,1)');
  assert.equal((await getSharedMaintenanceState()).importing,true);
  assert.equal(await tryStartImportJob('otro proceso'),false);
  await other.query('SELECT pg_advisory_unlock(16310,1)');
  assert.equal(await tryStartImportJob('proceso actual'),true);
  assert.equal((await other.query('SELECT pg_try_advisory_lock(16310,1) AS acquired')).rows[0].acquired,false);
  await endImportJob(); assert.equal((await getSharedMaintenanceState()).active,false);
 }finally{await other.end();await endImportJob()}
 console.log('✓ Dos conexiones independientes comparten el candado y el estado de importación');
 const csv=(originalname:string,text:string)=>({originalname,buffer:Buffer.from(text)});
 await assert.rejects(processCsvImportFiles([
  csv('Categories.csv','ID,Category\nROLLBACK,Rollback\n'),
  csv('Inventory.csv','Inventory ID,Item ID,DateTime,Amount,User ID,Reason\nINV-FAIL,NO-EXISTE,1/1/2026 8:00:00,-1,regression@test.local,Error\n')
 ],{includeLocalPhotoFolders:false,skipAssets:true,strictRows:true}));
 assert.equal(await prisma.itemCategory.count({where:{internal_id:'ROLLBACK'}}),0);
 const stockItem=await prisma.item.create({data:{internal_code:'KEEP',name:'Keep',uom:'PZA',stock:7,minimum_inventory:10}});
 await processCsvImportFiles([csv('Items.csv','Item ID,Name,Stock,UOM\nKEEP,Keep updated,999,PZA\n')],{includeLocalPhotoFolders:false,skipAssets:true});
 assert.equal((await prisma.item.findUniqueOrThrow({where:{id:stockItem.id}})).stock,7);
 console.log('✓ Un error revierte categorías previas; reimportar conserva el stock operativo');
 const vendor=await prisma.vendor.create({data:{internal_id:'TEST',name:'Test'}});
 const po=await prisma.purchaseOrder.create({data:{vendor_id:vendor.id,created_by_id:admin.id,status:'APROBADA',items:{create:{item_id:stockItem.id,quantity:10,unit_cost:2}}},include:{items:true}});
 const receive=async(qty:number,expected:number,key:string)=>{const res=response();await updatePurchaseOrderStatus({params:{id:po.id},user:{userId:admin.id,role:'ADMINISTRADOR'},body:{status:'RECIBIDA',client_request_id:key,received_items:[{id:po.items[0].id,received_quantity:qty,expected_received:expected}]}} as any,res);return res;};
 let res=await receive(4,0,'receipt-first');assert.equal(res.code,200,JSON.stringify(res.body));assert.equal(res.body.status,'ENVIADA');
 res=await receive(4,0,'receipt-first');assert.equal(res.code,200);
 assert.equal((await prisma.item.findUniqueOrThrow({where:{id:stockItem.id}})).stock,11);
 res=await receive(4,0,'receipt-stale');assert.equal(res.code,409);
 res=await receive(7,4,'receipt-excess');assert.equal(res.code,400);
 res=await receive(6,4,'receipt-last');assert.equal(res.code,200);assert.equal(res.body.status,'RECIBIDA');
 assert.equal((await prisma.item.findUniqueOrThrow({where:{id:stockItem.id}})).stock,17);
 assert.equal(await prisma.inventoryTransaction.count({where:{item_id:stockItem.id}}),2);
 console.log('✓ Entregas parciales, reintentos, pantalla desactualizada y exceso de recepción');
 for(let i=0;i<3;i++) await prisma.item.create({data:{internal_code:`LOW-${i}`,name:`Low ${i}`,stock:i,minimum_inventory:i,uom:'PZA'}});
 res=response();await getItems({query:{critical:'1',page:'2',limit:'2'}} as any,res);assert.equal(res.code,200);assert.equal(res.body.total,3);assert.equal(res.body.data.length,1);
 console.log('✓ Stock crítico filtra y pagina correctamente desde PostgreSQL');
 const zone=await prisma.zone.create({data:{name:'Prueba'}});
 const asset=await prisma.asset.create({data:{internal_code:'KPI164',name:'KPI',status:'OPERATIVO',brand:'Test',model:'Test',zone_id:zone.id}});
 for(const time of [0,3600000]) await prisma.workOrder.create({data:{title:'MTTR',asset_id:asset.id,created_by_id:admin.id,zone_id:zone.id,status:'FINALIZADO',maintenance_type:'CORRECTIVO',completed_at:new Date(),accumulated_time_ms:time}});
 res=response();await getKPIs({query:{period:'THIS_MONTH'}} as any,res);assert.equal(res.code,200);
 const metrics=res.body.metrics;assert.equal(metrics.SLA.sampleSize,1);assert.equal(metrics.SLA.missingCount,1);
 console.log('✓ El cumplimiento MTTR excluye duraciones cero y muestra el dato faltante');
}
main().then(async()=>{await prisma.$disconnect();process.exit(0)}).catch(async e=>{console.error(e);await prisma.$disconnect();process.exit(1)});
