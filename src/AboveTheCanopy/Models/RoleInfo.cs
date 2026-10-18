namespace AboveTheCanopy.Models;

/// <summary>Teaching content for each role shown in the info cards.</summary>
public sealed record RoleInfo(string Key, string Emoji, string Title, string Theme, string Sees, string[] Does, string Takeaway);

public static class Roles
{
    public static readonly RoleInfo Leader = new(
        "leader", "🦅", "The Leader", "Leadership = vision, priorities, backing the team & adapting",
        "An eagle flying above the canopy. Sees where the team is right now and holds the vision of the end goal (a pyramid the team will build, shown as a golden blueprint above the canopy), but can't see the obstacles on the forest floor.",
        new[]
        {
            "Sets the vision: where are we going, and why?",
            "Keeps everyone pointed at the goal when things get hard.",
            "Shares direction with the manager and checks the course.",
            "Leads more than one team: between check-ins the gold rings go out to other teams and projects (Team North, Project B, Partners, Budget, Strategy), and decisions and feedback come back.",
            "Recognises and celebrates the team's progress.",
            "Measures the project in days delivered, and accepts that surprises cost days.",
            "Filters competing priorities in meetings: yes to what serves the goal, \"not now\" to the rest.",
            "Accepts unavoidable delays and reassures: safety first, the goal stays the same.",
            "Backs the team: says YES to what they need (saws and safety gear, airdropped through the canopy after the tree falls).",
            "Protects the team's time: pushes back on the Board (\"The koalas need that time: the picnic can wait!\").",
            "Adapts: when better information comes up from the ground (Banjo's creek route), changes the plan and gives the credit back.",
            "Gets distracted too (magpies, \"urgent\" emails, storms) but always refocuses on the goal.",
            "During the build: keeps the vision steady, encourages the team, protects them from one last request (\"After the launch!\") and recognises them when the vision becomes reality."
        },
        "Leaders decide where we're going, back the people getting there, and change course when the ground knows better.");

    public static readonly RoleInfo Manager = new(
        "manager", "🦉", "The Manager", "Management = planning, removing obstacles, communication, coaching & delegating",
        "An owl flying below the canopy and above the team. Can't see the pyramid, but can see the obstacles ahead: vines, a boulder, a river, a bog, a fallen log, a cliff, a bees' nest and a rock wall.",
        new[]
        {
            "Turns the leader's vision into a plan and a route.",
            "Scouts ahead and spots obstacles before the team hits them.",
            "Communicates early and clearly, so the team is ready.",
            "Gets the team the tools and skills they need (cutting tools, hammer-and-chisel training, rope).",
            "Coordinates sideways with other managers: sharing resources, status updates, lending kit.",
            "Communicates both ways: warnings and plans down, progress, problems and ideas up (Banjo's creek route).",
            "Grows people: coaches one-to-one (Wattle and her saw) and delegates real responsibility (Kip leads the bridge build).",
            "Looks after wellbeing and morale: calls a break after the toughest stretch, and celebrates small wins (Matilda, Koala of the week).",
            "Escalates surprises from the ground to the leader, with what the team needs and the likely delay.",
            "Shakes off distractions (meeting requests, mozzies, snags) and gets back to the team.",
            "Supports the build without taking it over: organises the build sequence, brings stone to where it's needed, checks the plan against the leader's vision and relays progress up (\"Layer 4 done, two to go!\")."
        },
        "Managers connect vision to execution and grow the people doing it. Turn communication off and watch how much harder the team's journey gets.");

    public static readonly RoleInfo Team = new(
        "team", "🐨", "The Team", "Team members = execution, problem-solving & leading from the ground",
        "Four koalas walking the forest floor, cutting through bush after bush with their tools: Kip (orange hard hat), Banjo (blue bandana), Matilda (yellow hard hat) and Wattle (purple bandana, the smallest). They can only see a few metres ahead, so they rely on the manager's heads-up, but they see the ground better than anyone.",
        new[]
        {
            "Does the constant everyday work: cutting through bush after bush.",
            "Solves the big obstacles: bridges, stepping stones, ropes, ladders.",
            "Gathers the materials: fans out into the bush for logs, stones, planks and poles.",
            "Learns new skills when the job needs them (hammer and chisel for the boulder).",
            "Works together, because nobody crosses the river alone.",
            "Spots the surprises nobody planned for (sinkholes, falling trees, snakes) and reports them up straight away.",
            "Asks for what they need (\"Need more rope!\") and feeds back what's happening on the ground.",
            "Leads from the ground: spots better routes and fixes (Banjo's dry creek bed) and passes them up.",
            "Steps up when trusted with the lead (Kip and the bridge build), and keeps a sustainable pace (breaks, water, gum leaves).",
            "Builds the final product: uses every skill from the journey (gathering materials, hammer and chisel, planks, ropes, a ladder, log rollers, teamwork) to raise the pyramid layer by layer, then sets the capstone together."
        },
        "Teams make the vision real, one bush at a time. With good information they're fast and confident; without it they get surprises and wrong turns.");

    public static readonly RoleInfo Goal = new(
        "goal", "🔺", "The Goal", "The pyramid = the shared objective (the final product)",
        "Starts as the leader's vision: a golden blueprint shining above the canopy that only the leader can see. At the end the team builds the real pyramid inside it, layer by layer, and the outline turns solid.",
        new[]
        {
            "A clear, visible objective everyone can rally around.",
            "The leader holds the vision, the manager plans and supports, and the team builds it.",
            "Every milestone on the journey builds a skill the final product needs."
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
