local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Containers = require(script.Parent.Containers)
local WorldGen = require(script.Parent.WorldGen)

local Remotes = ReplicatedStorage.Remotes

local Builds = {}

local folder = Instance.new("Folder")
folder.Name = "Builds"
folder.Parent = workspace

local function anchoredPart(props: { [string]: any }): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for key, value in props do
		(p :: any)[key] = value
	end
	return p
end

local makers = {}

function makers.Campfire(model: Model, base: CFrame)
	for i = 1, 8 do
		local angle = i / 8 * math.pi * 2
		anchoredPart({
			Size = Vector3.new(0.9, 0.7, 0.9),
			CFrame = base * CFrame.new(math.cos(angle) * 2, 0.35, math.sin(angle) * 2),
			Material = Enum.Material.Slate,
			Color = Color3.fromRGB(110, 110, 115),
		}).Parent = model
	end

	for i = 1, 3 do
		anchoredPart({
			Shape = Enum.PartType.Cylinder,
			Size = Vector3.new(3, 0.6, 0.6),
			CFrame = base * CFrame.new(0, 0.4, 0) * CFrame.Angles(0, i / 3 * math.pi, 0),
			Material = Enum.Material.Wood,
			Color = Color3.fromRGB(80, 55, 35),
			CanCollide = false,
		}).Parent = model
	end

	local core = anchoredPart({
		Name = "Core",
		Size = Vector3.new(1, 1, 1),
		CFrame = base * CFrame.new(0, 0.8, 0),
		Transparency = 1,
		CanCollide = false,
	})
	core.Parent = model

	local fire = Instance.new("Fire")
	fire.Size = 4
	fire.Heat = 8
	fire.Parent = core

	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 170, 90)
	light.Range = 22
	light.Brightness = 2
	light.Parent = core
end

function makers.WoodWall(model: Model, base: CFrame)
	anchoredPart({
		Size = Vector3.new(10, 8, 1),
		CFrame = base * CFrame.new(0, 3.5, 0),
		Material = Enum.Material.WoodPlanks,
		Color = Color3.fromRGB(140, 100, 60),
	}).Parent = model
end

local wallColor = Color3.fromRGB(140, 100, 60)

function makers.DoorWall(model: Model, base: CFrame, owner: Player)
	for _, x in { -3.5, 3.5 } do
		anchoredPart({
			Size = Vector3.new(3, 8, 1),
			CFrame = base * CFrame.new(x, 3.5, 0),
			Material = Enum.Material.WoodPlanks,
			Color = wallColor,
		}).Parent = model
	end
	anchoredPart({
		Size = Vector3.new(4, 1, 1),
		CFrame = base * CFrame.new(0, 7, 0),
		Material = Enum.Material.WoodPlanks,
		Color = wallColor,
	}).Parent = model

	local closed = base * CFrame.new(0, 3, 0)
	local hinge = base * CFrame.new(-2, 3, 0)
	local opened = hinge * CFrame.Angles(0, math.rad(-95), 0) * CFrame.new(2, 0, 0)

	local door = anchoredPart({
		Name = "Door",
		Size = Vector3.new(4, 7, 0.4),
		CFrame = closed,
		Material = Enum.Material.Wood,
		Color = Color3.fromRGB(105, 70, 40),
	})
	door.Parent = model

	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Открыть"
	prompt.ObjectText = "Дверь"
	prompt.MaxActivationDistance = 8
	prompt.RequiresLineOfSight = false
	prompt.Parent = door

	local isOpen = false
	prompt.Triggered:Connect(function(player)
		if player.UserId ~= owner.UserId then
			Remotes.Notify:FireClient(player, "Дверь заперта")
			return
		end
		isOpen = not isOpen
		prompt.ActionText = isOpen and "Закрыть" or "Открыть"
		TweenService:Create(door, TweenInfo.new(0.35, Enum.EasingStyle.Quad), {
			CFrame = isOpen and opened or closed,
		}):Play()
	end)
end

function makers.Chest(model: Model, base: CFrame, owner: Player)
	local box = anchoredPart({
		Name = "Box",
		Size = Vector3.new(3.4, 1.8, 2.2),
		CFrame = base * CFrame.new(0, 0.9, 0),
		Material = Enum.Material.WoodPlanks,
		Color = Color3.fromRGB(125, 85, 50),
	})
	box.Parent = model
	anchoredPart({
		Size = Vector3.new(3.6, 0.4, 2.4),
		CFrame = base * CFrame.new(0, 2, 0),
		Material = Enum.Material.Wood,
		Color = Color3.fromRGB(95, 62, 38),
	}).Parent = model
	Containers.Register(model, box, "Ящик", owner.UserId)
end

-- Places a structure a few studs in front of the character, snapped to the ground.
function Builds.Place(player: Player, id: string): boolean
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not root or not makers[id] then
		return false
	end

	local forward = root.CFrame.LookVector
	forward = Vector3.new(forward.X, 0, forward.Z).Unit
	local ground = WorldGen.GroundBelow(root.Position + forward * 7)
	if not ground then
		return false
	end

	local model = Instance.new("Model")
	model.Name = id
	model:SetAttribute("Owner", player.UserId)
	makers[id](model, CFrame.lookAt(ground, ground + forward), player)
	model.Parent = folder
	return true
end

function Builds.NearCampfire(position: Vector3, radius: number): boolean
	for _, model in folder:GetChildren() do
		if model.Name == "Campfire" and (model:GetPivot().Position - position).Magnitude <= radius then
			return true
		end
	end
	return false
end

return Builds
