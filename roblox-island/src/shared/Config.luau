local Config = {}

Config.Island = {
	Radius = 260,
	Cell = 8,
	SeaLevel = 0,
	SeaFloor = -30,
	MaxHeight = 30,
}

Config.Items = { "Wood", "Stone", "Berries" }

Config.ItemNames = {
	Wood = "Дерево",
	Stone = "Камень",
	Berries = "Ягоды",
}

-- Amount: how much the node holds before it is used up.
Config.Resources = {
	Tree = { Item = "Wood", Amount = 30, Count = 90, Respawn = 90 },
	Rock = { Item = "Stone", Amount = 25, Count = 50, Respawn = 120 },
	Bush = { Item = "Berries", Amount = 6, Count = 40, Respawn = 60 },
}

Config.GatherRange = 9

Config.Tools = {
	Rock = {
		Display = "Камень",
		Cooldown = 0.6,
		Yield = { Wood = 2, Stone = 2, Berries = 2 },
	},
	StoneHatchet = {
		Display = "Каменный топор",
		Cooldown = 0.6,
		Yield = { Wood = 6, Stone = 1, Berries = 2 },
	},
	StonePickaxe = {
		Display = "Каменная кирка",
		Cooldown = 0.6,
		Yield = { Wood = 1, Stone = 5, Berries = 2 },
	},
}

Config.Recipes = {
	{ Id = "StoneHatchet", Kind = "Tool", Display = "Каменный топор", Cost = { Wood = 20, Stone = 10 } },
	{ Id = "StonePickaxe", Kind = "Tool", Display = "Каменная кирка", Cost = { Wood = 20, Stone = 15 } },
	{ Id = "Campfire", Kind = "Build", Display = "Костёр", Cost = { Wood = 30, Stone = 5 } },
	{ Id = "WoodWall", Kind = "Build", Display = "Деревянная стена", Cost = { Wood = 40 } },
}

Config.Survival = {
	MaxHunger = 100,
	HungerDrainEvery = 3,
	HungerDrainAmount = 1,
	StarveDamage = 2,
	BerryFood = 10,
	BerryHeal = 2,
	CampfireRadius = 12,
	CampfireHeal = 1,
	RespawnDelay = 5,
}

Config.DayLengthSeconds = 600

return Config
