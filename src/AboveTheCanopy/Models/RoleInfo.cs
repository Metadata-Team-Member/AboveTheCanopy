namespace AboveTheCanopy.Models;

/// <summary>Teaching content for each role shown in the info cards.</summary>
public sealed record RoleInfo(string Key, string Emoji, string Title, string Theme, string Sees, string[] Does, string Takeaway);

public static class Roles
{
    public static readonly RoleInfo Leader = new(
        "leader", "🦅", "The Leader", "Leadership = vision & direction",
        "An eagle flying above the canopy. Sees where the team started and the end goal (the pyramid), but can't see the obstacles on the forest floor.",
        new[]
        {
            "Sets the vision: where are we going, and why?",
            "Keeps everyone pointed at the goal when things get hard.",
            "Shares direction with the manager and checks the course.",
            "Recognises and celebrates the team's progress.",
            "Measures the project in days delivered, and accepts that surprises cost days.",
            "Filters competing priorities in meetings: yes to what serves the goal, \"not now\" to the rest.",
            "Accepts unavoidable delays and reassures: safety first, the goal stays the same.",
            "Gets distracted too (magpies, \"urgent\" emails, storms) but always refocuses on the goal."
        },
        "Leaders decide where we're going. They need managers and teams to work out how to get there.");

    public static readonly RoleInfo Manager = new(
        "manager", "🦉", "The Manager", "Management = planning, removing obstacles, communication",
        "An owl flying below the canopy and above the team. Can't see the pyramid, but can see the obstacles ahead: vines, a boulder, a river, a bog, a fallen log, a cliff, a bees' nest and a rock wall.",
        new[]
        {
            "Turns the leader's vision into a plan and a route.",
            "Scouts ahead and spots obstacles before the team hits them.",
            "Communicates early and clearly, so the team is ready.",
            "Gets the team the tools and skills they need (cutting tools, hammer-and-chisel training, rope).",
            "Coordinates sideways with other managers: sharing resources, status syncs, lending kit.",
            "Reports progress up to the leader and answers the team's requests.",
            "Escalates surprises from the ground to the leader, with what the team needs and the likely delay.",
            "Shakes off distractions (meeting requests, mozzies, snags) and gets back to the team."
        },
        "Managers connect vision to execution. Turn communication off and watch how much harder the team's journey gets.");

    public static readonly RoleInfo Team = new(
        "team", "🐨", "The Team", "Team members = execution & problem-solving on the ground",
        "Four koalas walking the forest floor, cutting through bush after bush with their tools. They can only see a few metres ahead, so they rely on the manager's heads-up.",
        new[]
        {
            "Does the constant everyday work: cutting through bush after bush.",
            "Solves the big obstacles: bridges, stepping stones, ropes, ladders.",
            "Gathers the materials: fans out into the bush for logs, stones, planks and poles.",
            "Learns new skills when the job needs them (hammer and chisel for the boulder).",
            "Works together, because nobody crosses the river alone.",
            "Spots the surprises nobody planned for (sinkholes, falling trees, snakes) and reports them up straight away.",
            "Asks for what they need (\"Need more rope!\") and feeds back what's happening on the ground."
        },
        "Teams make the vision real, one bush at a time. With good information they're fast and confident; without it they get surprises and wrong turns.");

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
