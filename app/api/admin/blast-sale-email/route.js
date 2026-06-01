import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function getFirstName(n){if(!n)return 'there';const p=n.trim().split(/\s+/);return p[0].charAt(0).toUpperCase()+p[0].slice(1).toLowerCase()}

function buildEmail(firstName,template){
const isInitial=template==='initial'
const subject=isInitial?'Our Start of Summer Sale starts Sunday - 15% off sitewide':'Start of Summer Sale is LIVE - 15% off ends June 11'
const intro=isInitial?'Summer is here - and we\'re kicking it off with a <strong>5-day sitewide sale</strong> starting this Sunday, June 7th.':'Just a reminder - our <strong>Start of Summer Sale</strong> is live now through June 11th.'
const html=`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="background:#0d1b2a;padding:24px 30px;text-align:center;"><span style="font-size:22px;font-weight:800;color:#4fc3f7;letter-spacing:2px;">FORGE AMINO</span></td></tr><tr><td style="background:#1a2e40;padding:30px;text-align:center;"><div style="font-size:32px;font-weight:900;color:#ffffff;">Start of Summer Sale</div><div style="font-size:16px;color:#b0c8dd;margin-top:6px;">June 7 - June 11 - 15% off sitewide</div></td></tr><tr><td style="background:#ffffff;padding:30px;"><p style="margin-top:0;font-size:15px;color:#333;">Hey ${firstName},</p><p style="font-size:15px;color:#333;">${intro}</p><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border:2px dashed #4fc3f7;border-radius:6px;padding:18px 24px;text-align:center;background:#f0faff;"><div style="font-size:32px;font-weight:900;letter-spacing:6px;color:#0d1b2a;font-family:monospace;">SUMMER15</div><div style="font-size:13px;color:#555;margin-top:6px;">15% off - No minimum - Valid June 7-11</div></td></tr></table><p style="text-align:center;margin:24px 0;"><a href="https://forgeamino.com" style="display:inline-block;background:#4fc3f7;color:#0d1b2a;font-weight:700;font-size:16px;padding:14px 36px;border-radius:4px;text-decoration:none;">SHOP THE SALE</a></p><p style="font-size:15px;color:#333;">- The Forge Amino Team</p></td></tr><tr><td style="background:#0d1b2a;padding:20px 30px;text-align:center;"><p style="margin:0;font-size:11px;color:#aaa;">You received this because you are a Forge Amino customer.</p></td></tr></table></td></tr></table></body></html>`
return{subject,html}}

export async function POST(request){
try{
const secret=request.headers.get('x-blast-secret')
if(!process.env.BLAST_SECRET||secret!==process.env.BLAST_SECRET)return NextResponse.json({error:'Unauthorized'},{status:401})
const body=await request.json().catch(()=>({}))
const{template='initial',dryRun=false}=body
const{data:customers,error}=await supabase.from('orders').select('customer_email,customer_name,created_at').eq('payment_status','paid').order('customer_email').order('created_at',{ascending:false})
if(error)throw error
const testEmails=new Set(['test@example.com','qbolivetest@example.com'])
const seen=new Set()
const unique=customers.filter(c=>{const e=c.customer_email?.toLowerCase();if(!e||testEmails.has(e)||seen.has(e))return false;seen.add(e);return true})
if(dryRun)return NextResponse.json({dryRun:true,count:unique.length,template,customers:unique.map(c=>({email:c.customer_email,name:c.customer_name}))})
const results=[]
for(const customer of unique){
const firstName=getFirstName(customer.customer_name)
const{subject,html}=buildEmail(firstName,template)
try{
const{data,error:sendError}=await resend.emails.send({from:'Forge Amino <orders@forgeamino.us>',replyTo:'forgeamino@gmail.com',to:customer.customer_email,subject,html})
if(sendError)throw sendError
results.push({email:customer.customer_email,success:true,id:data?.id})
}catch(err){results.push({email:customer.customer_email,success:false,error:err.message})}
await new Promise(r=>setTimeout(r,100))
}
const succeeded=results.filter(r=>r.success).length
return NextResponse.json({sent:succeeded,failed:results.length-succeeded,template,results})
}catch(err){return NextResponse.json({error:err.message},{status:500})}}
