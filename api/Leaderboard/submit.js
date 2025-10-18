// In-memory leaderboard storage (will reset on server restart)
const leaderboardData = []

module.exports = async (req, res) => {
  console.log("[v0] Leaderboard submit endpoint called")

  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { fid, username, score } = req.body

    console.log("[v0] Received score submission:", { fid, username, score })

    // Validate input
    if (!fid || !username || typeof score !== "number") {
      return res.status(400).json({
        error: "Missing required fields: fid, username, score",
      })
    }

    // Check if player already exists
    const existingPlayerIndex = leaderboardData.findIndex((p) => p.fid === fid)

    if (existingPlayerIndex !== -1) {
      // Update existing player if new score is higher
      if (score > leaderboardData[existingPlayerIndex].score) {
        leaderboardData[existingPlayerIndex] = {
          fid,
          username,
          score,
          lastPlayed: new Date().toISOString(),
        }
        console.log("[v0] Updated player with higher score")
      }
    } else {
      // Add new player
      leaderboardData.push({
        fid,
        username,
        score,
        lastPlayed: new Date().toISOString(),
      })
      console.log("[v0] Added new player to leaderboard")
    }

    // Calculate rank
    const sortedData = [...leaderboardData].sort((a, b) => b.score - a.score)
    const rank = sortedData.findIndex((p) => p.fid === fid) + 1

    res.status(200).json({
      success: true,
      rank,
      score,
    })
  } catch (error) {
    console.error("[v0] Error submitting score:", error)
    res.status(500).json({ error: "Failed to submit score" })
  }
}

