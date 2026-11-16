local Config = {}

Config.Island = {
	Radius = 260,
	Cell = 8,
	SeaLevel = 0,
	SeaFloor = -30,
	MaxHeight = 30,
}

Config.Items = { "Wood", "Stone", "Berries", "Meat", "CookedMeat" }

Config.ItemNames = {
	Wood = "Дерево",
	Stone = "Камень",
	Berries = "Ягоды",
	Meat = "Сырое мясо",
	CookedMeat = "Жареное мясо",
}

-- Amount: how much the node holds before it is used up.
Config.Resources = {
	Tree = { Item = "Wood", Amount = 30, Count = 90, Respawn = 90 },
	Rock = { Item = "Stone", Amount = 25, Count = 50, Respawn = 120 },
	Bush = { Item = "Berries", Amount = 6, Count = 40, Respawn = 60 },
}

Config.GatherRange = 9
Config.MeleeRange = 7
Config.PvP = true

Config.Tools = {
	Rock = {
		Display = "Камень",
		Cooldown = 0.6,
		Damage = 6,
		Yield = { Wood = 2, Stone = 2, Berries = 2 },
	},
	StoneHatchet = {
		Display = "Каменный топор",
		Cooldown = 0.6,
		Damage = 14,
		Yield = { Wood = 6, Stone = 1, Berries = 2 },
	},
	StonePickaxe = {
		Display = "Каменная кирка",
		Cooldown = 0.6,
		Damage = 10,
		Yield = { Wood = 1, Stone = 5, Berries = 2 },
	},
}

Config.Animals = {
	Boar = {
		Display = "Кабан",
		Health = 40,
		Count = 12,
		Respawn = 120,
		WalkSpeed = 6,
		RunSpeed = 13,
		Damage = 8,
		AttackRange = 5,
		AttackCooldown = 1.5,
		AngryTime = 12,
		Meat = 4,
	},
}

-- Kind: "Tool" goes to the backpack, "Build" is placed in front of the player,
-- "Cook" turns Cost into Gives and must be done next to a campfire.
Config.Recipes = {
	{ Id = "StoneHatchet", Kind = "Tool", Display = "Каменный топор", Cost = { Wood = 20, Stone = 10 } },
	{ Id = "StonePickaxe", Kind = "Tool", Display = "Каменная кирка", Cost = { Wood = 20, Stone = 15 } },
	{ Id = "Campfire", Kind = "Build", Display = "Костёр", Cost = { Wood = 30, Stone = 5 } },
	{ Id = "WoodWall", Kind = "Build", Display = "Деревянная стена", Cost = { Wood = 40 } },
	{ Id = "DoorWall", Kind = "Build", Display = "Стена с дверью", Cost = { Wood = 50, Stone = 5 } },
	{ Id = "Chest", Kind = "Build", Display = "Ящик", Cost = { Wood = 40 } },
	{ Id = "CookMeat", Kind = "Cook", Display = "Пожарить мясо", Cost = { Meat = 1 }, Gives = { CookedMeat = 1 } },
}

-- Eaten in this order when the player presses the eat key.
Config.Food = {
	{ Item = "CookedMeat", Hunger = 30, Heal = 10 },
	{ Item = "Berries", Hunger = 10, Heal = 2 },
}

Config.Survival = {
	MaxHunger = 100,
	HungerDrainEvery = 3,
	HungerDrainAmount = 1,
	StarveDamage = 2,
	CampfireRadius = 12,
	CampfireHeal = 1,
	RespawnDelay = 5,
	LootBagLifetime = 300,
}

Config.DayLengthSeconds = 600

Config.Save = {
	DataStore = "RustIsland_v1",
	AutosaveInterval = 120,
}

-- Put the Game Pass id from the Creator Dashboard here; while it is 0 the pass can't be bought.
Config.GamePasses = {
	{
		Key = "VIP",
		Id = 0,
		Display = "VIP",
		Description = "Двойная добыча ресурсов и каменный топор при каждом появлении",
	},
}

Config.VipYieldMultiplier = 2

return Config
