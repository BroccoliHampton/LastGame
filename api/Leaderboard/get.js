const leaderboardData = []

module.exports = async (req, res) => {
  console.log("[v0] Leaderboard get endpoint called")

  try {
    // Sort by score (highest first) and return top 10
    const topPlayers = leaderboardData
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((player, index) => ({
        rank: index + 1,
        fid: player.fid,
        username: player.username,
        score: player.score,
        lastPlayed: player.lastPlayed,
      }))

    console.log("[v0] Retrieved top players:", topPlayers.length)

    res.status(200).json({ leaderboard: topPlayers })
  } catch (error) {
    console.error("[v0] Error fetching leaderboard:", error)
    res.status(500).json({ error: "Failed to fetch leaderboard" })
  }
}
