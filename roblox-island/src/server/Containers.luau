local Debris = game:GetService("Debris")
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local PlayerData = require(script.Parent.PlayerData)

local Remotes = ReplicatedStorage.Remotes

local Containers = {}

type Container = {
	id: string,
	model: Model,
	title: string,
	owner: number?,
	items: { [string]: number },
	removeWhenEmpty: boolean,
	viewers: { [Player]: boolean },
}

local containers: { [string]: Container } = {}

local lootFolder = Instance.new("Folder")
lootFolder.Name = "LootBags"
lootFolder.Parent = workspace

local function canAccess(container: Container, player: Player): boolean
	return container.owner == nil or container.owner == player.UserId
end

local function isNear(container: Container, player: Player): boolean
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
	return root ~= nil and (root.Position - container.model:GetPivot().Position).Magnitude <= 14
end

local function broadcast(container: Container)
	for viewer in container.viewers do
		if viewer.Parent then
			Remotes.Container:FireClient(viewer, "Update", container.id, container.items)
		end
	end
end

-- Makes `model` openable through a ProximityPrompt on `promptPart`.
-- `owner` is a UserId that may open it; nil means anyone can.
function Containers.Register(model: Model, promptPart: BasePart, title: string, owner: number?, items: { [string]: number }?, removeWhenEmpty: boolean?)
	local id = HttpService:GenerateGUID(false)
	local container: Container = {
		id = id,
		model = model,
		title = title,
		owner = owner,
		items = {},
		removeWhenEmpty = removeWhenEmpty == true,
		viewers = {},
	}
	for _, item in Config.Items do
		container.items[item] = items and items[item] or 0
	end
	containers[id] = container

	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Открыть"
	prompt.ObjectText = title
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.MaxActivationDistance = 8
	prompt.RequiresLineOfSight = false
	prompt.Parent = promptPart

	prompt.Triggered:Connect(function(player)
		if not canAccess(container, player) then
			Remotes.Notify:FireClient(player, "Это чужой " .. string.lower(title))
			return
		end
		container.viewers[player] = true
		Remotes.Container:FireClient(player, "Open", id, container.items, title, model)
	end)

	model.Destroying:Connect(function()
		containers[id] = nil
		for viewer in container.viewers do
			if viewer.Parent then
				Remotes.Container:FireClient(viewer, "Close", id)
			end
		end
	end)
end

local function isEmpty(container: Container): boolean
	for _, amount in container.items do
		if amount > 0 then
			return false
		end
	end
	return true
end

-- Moves every unit of `item` between the player and the container.
function Containers.Transfer(player: Player, id: unknown, item: unknown, toContainer: boolean)
	local container = typeof(id) == "string" and containers[id]
	if not container or typeof(item) ~= "string" or container.items[item] == nil then
		return
	end
	if not canAccess(container, player) or not isNear(container, player) then
		return
	end

	if toContainer then
		local amount = PlayerData.GetItem(player, item)
		PlayerData.AddItem(player, item, -amount)
		container.items[item] += amount
	else
		local amount = container.items[item]
		container.items[item] = 0
		PlayerData.AddItem(player, item, amount)
	end

	broadcast(container)
	if container.removeWhenEmpty and isEmpty(container) then
		container.model:Destroy()
	end
end

function Containers.StopViewing(player: Player, id: unknown)
	local container = typeof(id) == "string" and containers[id]
	if container then
		container.viewers[player] = nil
	end
end

function Containers.DropLootBag(position: Vector3, items: { [string]: number }, ownerName: string)
	if next(items) == nil then
		return
	end

	local model = Instance.new("Model")
	model.Name = "LootBag"

	local bag = Instance.new("Part")
	bag.Name = "Bag"
	bag.Shape = Enum.PartType.Ball
	bag.Size = Vector3.new(2.2, 2.2, 2.2)
	bag.Color = Color3.fromRGB(120, 95, 60)
	bag.Material = Enum.Material.Fabric
	bag.Anchored = true
	bag.CanCollide = false
	bag.CFrame = CFrame.new(position + Vector3.new(0, 1, 0))
	bag.Parent = model

	model.Parent = lootFolder
	Containers.Register(model, bag, "Рюкзак " .. ownerName, nil, items, true)
	Debris:AddItem(model, Config.Survival.LootBagLifetime)
end

Players.PlayerRemoving:Connect(function(player)
	for _, container in containers do
		container.viewers[player] = nil
	end
end)

return Containers
