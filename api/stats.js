// Placeholder stats endpoint. Reads from Supabase once persistence is wired in.
module.exports = (req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      total_students: 0,
      completed_assessments: 0,
      qualified_leads: 0,
      colleges_connected: 0,
      leads_contacted: 0,
      leads_enrolled: 0,
    })
  );
};
