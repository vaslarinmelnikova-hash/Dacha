local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Builds = require(script.Parent.Builds)
local Resources = require(script.Parent.Resources)
local Tools = require(script.Parent.Tools)
local WorldGen = require(script.Parent.WorldGen)

local Remotes = ReplicatedStorage.Remotes
local survival = Config.Survival

local function notify(player: Player, text: string)
	Remotes.Notify:FireClient(player, text)
end

local function addItem(player: Player, item: string, amount: number)
	player:SetAttribute(item, ((player:GetAttribute(item) :: number?) or 0) + amount)
end

local function clearInventory(player: Player)
	for _, item in Config.Items do
		player:SetAttribute(item, 0)
	end
end

local function onSwing(player: Player, _tool: Tool, toolId: string)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not root then
		return
	end
	local target = Resources.FindTarget(root, Config.GatherRange)
	if not target then
		return
	end
	local item, amount = Resources.Hit(target, Config.Tools[toolId].Yield)
	if item and amount > 0 then
		addItem(player, item, amount)
		notify(player, string.format("+%d %s", amount, Config.ItemNames[item]))
	elseif item then
		notify(player, "Этим инструментом тут ничего не добыть")
	end
end

local function giveTool(player: Player, id: string)
	Tools.Create(id, onSwing).Parent = player:WaitForChild("Backpack")
end

local function canAfford(player: Player, cost: { [string]: number }): boolean
	for item, amount in cost do
		if (player:GetAttribute(item) or 0) < amount then
			return false
		end
	end
	return true
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
	if not canAfford(player, recipe.Cost) then
		notify(player, "Не хватает ресурсов")
		return
	end
	if recipe.Kind == "Tool" then
		if Tools.Has(player, recipe.Id) then
			notify(player, "У тебя уже есть " .. recipe.Display)
			return
		end
		giveTool(player, recipe.Id)
	elseif not Builds.Place(player, recipe.Id) then
		notify(player, "Здесь нельзя строить")
		return
	end
	for item, amount in recipe.Cost do
		addItem(player, item, -amount)
	end
	notify(player, "Создано: " .. recipe.Display)
end

local function eat(player: Player)
	local humanoid = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if not humanoid or humanoid.Health <= 0 then
		return
	end
	if (player:GetAttribute("Berries") or 0) < 1 then
		notify(player, "Нет ягод")
		return
	end
	addItem(player, "Berries", -1)
	player:SetAttribute("Hunger", math.min(survival.MaxHunger, player:GetAttribute("Hunger") + survival.BerryFood))
	humanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health + survival.BerryHeal)
end

local lastAction: { [Player]: number } = {}

Remotes.Action.OnServerEvent:Connect(function(player: Player, action: unknown, arg: unknown)
	local now = os.clock()
	if now - (lastAction[player] or 0) < 0.2 then
		return
	end
	lastAction[player] = now

	if action == "Craft" and typeof(arg) == "string" then
		craft(player, arg)
	elseif action == "Eat" then
		eat(player)
	end
end)

local function spawnPlayer(player: Player)
	if not player.Parent then
		return
	end
	player:LoadCharacterAsync()
end

local function onCharacter(player: Player, character: Model)
	clearInventory(player)
	player:SetAttribute("Hunger", survival.MaxHunger)
	giveTool(player, "Rock")

	local spot = WorldGen.RandomSurface({ Enum.Material.Sand }, 200)
		or WorldGen.RandomSurface({ Enum.Material.Grass }, 200)
	if spot then
		character:WaitForChild("HumanoidRootPart")
		character:PivotTo(CFrame.new(spot + Vector3.new(0, 4, 0)))
	end

	local humanoid = character:WaitForChild("Humanoid") :: Humanoid
	humanoid.Died:Connect(function()
		notify(player, "Ты погиб. Всё, что было с собой, потеряно.")
		task.delay(survival.RespawnDelay, spawnPlayer, player)
	end)
end

local function onPlayer(player: Player)
	clearInventory(player)
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

Players.PlayerAdded:Connect(onPlayer)
Players.PlayerRemoving:Connect(function(player)
	lastAction[player] = nil
end)
for _, player in Players:GetPlayers() do
	task.spawn(onPlayer, player)
end

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
		local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if humanoid and root and humanoid.Health > 0 then
			local hunger = player:GetAttribute("Hunger") or survival.MaxHunger
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
