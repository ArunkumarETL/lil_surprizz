export async function GET() {
  return Response.json({ error: "Payment instructions are now arranged directly with the store." }, { status: 410 });
}
