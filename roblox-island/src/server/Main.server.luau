local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Animals = require(script.Parent.Animals)
local Builds = require(script.Parent.Builds)
local Containers = require(script.Parent.Containers)
local PlayerData = require(script.Parent.PlayerData)
local Resources = require(script.Parent.Resources)
local Shop = require(script.Parent.Shop)
local Targeting = require(script.Parent.Targeting)
local Tools = require(script.Parent.Tools)
local WorldGen = require(script.Parent.WorldGen)

local Remotes = ReplicatedStorage.Remotes
local survival = Config.Survival

local function notify(player: Player, text: string)
	Remotes.Notify:FireClient(player, text)
end

local function rootOf(player: Player): BasePart?
	local character = player.Character
	return character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
end

local function findPlayerTarget(attacker: Player, root: BasePart): (Humanoid?, number)
	local best, bestDistance = nil, math.huge
	for _, other in Players:GetPlayers() do
		local otherRoot = other ~= attacker and rootOf(other)
		local humanoid = otherRoot and otherRoot.Parent:FindFirstChildOfClass("Humanoid")
		if otherRoot and humanoid and humanoid.Health > 0 then
			local distance = Targeting.InFront(root, otherRoot.Position, Config.MeleeRange)
			if distance and distance < bestDistance then
				best, bestDistance = humanoid, distance
			end
		end
	end
	return best, bestDistance
end

local function onSwing(player: Player, _tool: Tool, toolId: string)
	local root = rootOf(player)
	if not root then
		return
	end
	local def = Config.Tools[toolId]

	local victim, victimDistance = nil, math.huge
	if Config.PvP then
		victim, victimDistance = findPlayerTarget(player, root)
	end
	local animal, animalDistance = Animals.FindTarget(root, Config.MeleeRange)

	if victim and victimDistance <= animalDistance then
		victim:TakeDamage(def.Damage)
		return
	end

	if animal then
		local meat = Animals.Damage(animal, def.Damage, player)
		if meat > 0 then
			PlayerData.AddItem(player, "Meat", meat)
			notify(player, string.format("+%d %s", meat, Config.ItemNames.Meat))
		end
		return
	end

	local target = Resources.FindTarget(root, Config.GatherRange)
	if not target then
		return
	end
	local item, amount = Resources.Hit(target, def.Yield)
	if item and amount > 0 then
		if Shop.Has(player, "VIP") then
			amount *= Config.VipYieldMultiplier
		end
		PlayerData.AddItem(player, item, amount)
		notify(player, string.format("+%d %s", amount, Config.ItemNames[item]))
	elseif item then
		notify(player, "Этим инструментом тут ничего не добыть")
	end
end

local function giveTool(player: Player, id: string)
	Tools.Create(id, onSwing).Parent = player:WaitForChild("Backpack")
end

local function craft(player: Player, recipeId: string)
	local recipe
	for _, r in Config.Recipes do
		if r.Id == recipeId then
			recipe = r
		end
	end
	if not recipe then
		return
	end
	if not PlayerData.CanAfford(player, recipe.Cost) then
		notify(player, "Не хватает ресурсов")
		return
	end

	if recipe.Kind == "Tool" then
		if PlayerData.HasTool(player, recipe.Id) then
			notify(player, "У тебя уже есть " .. recipe.Display)
			return
		end
		PlayerData.AddTool(player, recipe.Id)
		giveTool(player, recipe.Id)
	elseif recipe.Kind == "Cook" then
		local root = rootOf(player)
		if not root or not Builds.NearCampfire(root.Position, survival.CampfireRadius) then
			notify(player, "Встань рядом с костром")
			return
		end
		for item, amount in recipe.Gives do
			PlayerData.AddItem(player, item, amount)
		end
	elseif not Builds.Place(player, recipe.Id) then
		notify(player, "Здесь нельзя строить")
		return
	end

	for item, amount in recipe.Cost do
		PlayerData.AddItem(player, item, -amount)
	end
	notify(player, "Готово: " .. recipe.Display)
end

local function eat(player: Player)
	local humanoid = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if not humanoid or humanoid.Health <= 0 then
		return
	end
	for _, food in Config.Food do
		if PlayerData.GetItem(player, food.Item) > 0 then
			PlayerData.AddItem(player, food.Item, -1)
			local hunger = (player:GetAttribute("Hunger") :: number?) or 0
			player:SetAttribute("Hunger", math.min(survival.MaxHunger, hunger + food.Hunger))
			humanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health + food.Heal)
			notify(player, "Съедено: " .. Config.ItemNames[food.Item])
			return
		end
	end
	notify(player, "Нечего есть")
end

local lastAction: { [Player]: number } = {}

Remotes.Action.OnServerEvent:Connect(function(player: Player, action: unknown, arg: unknown, extra: unknown)
	local now = os.clock()
	if now - (lastAction[player] or 0) < 0.15 then
		return
	end
	lastAction[player] = now

	if action == "Craft" and typeof(arg) == "string" then
		craft(player, arg)
	elseif action == "Eat" then
		eat(player)
	elseif action == "Store" then
		Containers.Transfer(player, arg, extra, true)
	elseif action == "Take" then
		Containers.Transfer(player, arg, extra, false)
	elseif action == "CloseContainer" then
		Containers.StopViewing(player, arg)
	end
end)

local function spawnPlayer(player: Player)
	if player.Parent then
		player:LoadCharacterAsync()
	end
end

local function onCharacter(player: Player, character: Model)
	player:SetAttribute("Hunger", survival.MaxHunger)

	if Shop.Has(player, "VIP") then
		PlayerData.AddTool(player, "StoneHatchet")
	end
	giveTool(player, "Rock")
	for _, id in PlayerData.OwnedTools(player) do
		giveTool(player, id)
	end

	local spot = WorldGen.RandomSurface({ Enum.Material.Sand }, 200)
		or WorldGen.RandomSurface({ Enum.Material.Grass }, 200)
	if spot then
		character:WaitForChild("HumanoidRootPart")
		character:PivotTo(CFrame.new(spot + Vector3.new(0, 4, 0)))
	end

	local humanoid = character:WaitForChild("Humanoid") :: Humanoid
	humanoid.Died:Connect(function()
		local root = character:FindFirstChild("HumanoidRootPart") :: BasePart?
		local items = PlayerData.TakeAllItems(player)
		PlayerData.ClearTools(player)
		if root then
			Containers.DropLootBag(root.Position, items, player.Name)
		end
		notify(player, "Ты погиб. Твой рюкзак остался на месте смерти.")
		task.delay(survival.RespawnDelay, spawnPlayer, player)
	end)
end

local function onPlayer(player: Player)
	PlayerData.Load(player)
	Shop.Load(player)
	player.CharacterAdded:Connect(function(character)
		onCharacter(player, character)
	end)
	spawnPlayer(player)
end

Lighting.ClockTime = 8
local atmosphere = Instance.new("Atmosphere")
atmosphere.Density = 0.3
atmosphere.Haze = 1
atmosphere.Parent = Lighting

WorldGen.Generate()
Resources.SpawnAll()
Animals.SpawnAll()
Animals.Run()
Shop.Init()

Players.PlayerAdded:Connect(onPlayer)
Players.PlayerRemoving:Connect(function(player)
	lastAction[player] = nil
	PlayerData.Save(player)
	PlayerData.Remove(player)
end)
for _, player in Players:GetPlayers() do
	task.spawn(onPlayer, player)
end

game:BindToClose(function()
	for _, player in Players:GetPlayers() do
		PlayerData.Save(player)
	end
end)

task.spawn(function()
	while true do
		task.wait(Config.Save.AutosaveInterval)
		PlayerData.SaveAll(Players:GetPlayers())
	end
end)

local hungerTimer = 0
while true do
	local dt = task.wait(1)
	Lighting.ClockTime = (Lighting.ClockTime + dt * 24 / Config.DayLengthSeconds) % 24

	hungerTimer += dt
	local drain = hungerTimer >= survival.HungerDrainEvery
	if drain then
		hungerTimer = 0
	end

	for _, player in Players:GetPlayers() do
		local character = player.Character
		local humanoid = character and character:FindFirstChildOfClass("Humanoid")
		local root = rootOf(player)
		if humanoid and root and humanoid.Health > 0 then
			local hunger = (player:GetAttribute("Hunger") :: number?) or survival.MaxHunger
			if drain then
				hunger = math.max(0, hunger - survival.HungerDrainAmount)
				player:SetAttribute("Hunger", hunger)
			end
			if hunger <= 0 then
				humanoid:TakeDamage(survival.StarveDamage)
			end
			if Builds.NearCampfire(root.Position, survival.CampfireRadius) then
				humanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health + survival.CampfireHeal)
			end
		end
	end
end
