namespace AboveTheCanopy.Models;

/// <summary>Teaching content for each role shown in the info cards.</summary>
public sealed record RoleInfo(string Key, string Emoji, string Title, string Theme, string Sees, string[] Does, string Takeaway);

public static class Roles
{
    public static readonly RoleInfo Leader = new(
        "leader", "🦅", "The Leader", "Leadership = vision & direction",
        "Flies above the canopy. Sees where the team started and the end goal (the pyramid), but can't see the obstacles on the forest floor.",
        new[]
        {
            "Sets the vision: where are we going, and why?",
            "Keeps everyone pointed at the goal when things get hard.",
            "Shares direction with the manager and checks the course.",
            "Inspires and celebrates, without micromanaging the ground."
        },
        "Leaders decide where we're going. They need managers and teams to work out how to get there.");

    public static readonly RoleInfo Manager = new(
        "manager", "🦉", "The Manager", "Management = planning, removing obstacles, communication",
        "Flies below the canopy and above the team. Can't see the pyramid, but can see the obstacles ahead: vines, a boulder, a river, a cliff.",
        new[]
        {
            "Turns the leader's vision into a plan and a route.",
            "Scouts ahead and spots obstacles before the team hits them.",
            "Communicates early and clearly, so the team is ready.",
            "Gets the team the tools they need (machetes, logs, rope)."
        },
        "Managers connect vision to execution. Turn communication off and watch how much harder the team's journey gets.");

    public static readonly RoleInfo Team = new(
        "team", "🧑‍🤝‍🧑", "The Team", "Team members = execution & problem-solving on the ground",
        "Walks through vines and bushes on the forest floor. Can only see a few metres ahead, so they rely on the manager's heads-up.",
        new[]
        {
            "Does the real work: cutting paths, building bridges, climbing down.",
            "Solves problems on the spot, with real skills and grit.",
            "Works together, because nobody crosses the river alone.",
            "Feeds back what's happening on the ground."
        },
        "Teams make the vision real. With good information they're fast and confident; without it they get surprises and wrong turns.");

    public static readonly RoleInfo Goal = new(
        "goal", "🔺", "The Goal", "The pyramid = the shared objective",
        "Pokes out above the canopy, so only the leader can see it from the start.",
        new[]
        {
            "A clear, visible objective everyone can rally around.",
            "The leader holds it, the manager plans toward it, and the team reaches it."
        },
        "A goal only one person can see is a goal only one person can chase. Share it!");

    public static RoleInfo? Get(string? key) => key switch
    {
        "leader" => Leader,
        "manager" => Manager,
        "team" => Team,
        "goal" => Goal,
        _ => null
    };
}
