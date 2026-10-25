local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Targeting = require(script.Parent.Targeting)
local WorldGen = require(script.Parent.WorldGen)

local Resources = {}

local rng = Random.new()
local folder = Instance.new("Folder")
folder.Name = "Resources"
folder.Parent = workspace

local basePivots: { [Model]: CFrame } = {}

local function part(props: { [string]: any }): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for key, value in props do
		(p :: any)[key] = value
	end
	return p
end

local builders = {}

function builders.Tree(model: Model, ground: Vector3)
	local height = rng:NextNumber(12, 18)
	local trunk = part({
		Name = "Trunk",
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(height, 2.2, 2.2),
		CFrame = CFrame.new(ground + Vector3.new(0, height / 2 - 0.5, 0)) * CFrame.Angles(0, 0, math.rad(90)),
		Material = Enum.Material.Wood,
		Color = Color3.fromRGB(105, 72, 45),
	})
	trunk.Parent = model

	local leafSize = rng:NextNumber(8, 12)
	local leaves = part({
		Name = "Leaves",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(leafSize, leafSize, leafSize),
		CFrame = CFrame.new(ground + Vector3.new(0, height, 0)),
		Material = Enum.Material.Grass,
		Color = Color3.fromRGB(58, 125, 50):Lerp(Color3.fromRGB(90, 150, 60), rng:NextNumber()),
	})
	leaves.Parent = model
end

function builders.Rock(model: Model, ground: Vector3)
	local size = Vector3.new(rng:NextNumber(4, 7), rng:NextNumber(3, 5), rng:NextNumber(4, 7))
	local rotation = CFrame.Angles(rng:NextNumber(-0.4, 0.4), rng:NextNumber(0, math.pi * 2), rng:NextNumber(-0.4, 0.4))
	local stone = part({
		Name = "Stone",
		Size = size,
		CFrame = CFrame.new(ground + Vector3.new(0, size.Y / 2 - 1, 0)) * rotation,
		Material = Enum.Material.Slate,
		Color = Color3.fromRGB(120, 120, 125),
	})
	stone.Parent = model
end

function builders.Bush(model: Model, ground: Vector3)
	local bush = part({
		Name = "Bush",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(4.5, 4.5, 4.5),
		CFrame = CFrame.new(ground + Vector3.new(0, 1.5, 0)),
		Material = Enum.Material.Grass,
		Color = Color3.fromRGB(45, 105, 45),
	})
	bush.Parent = model

	for _ = 1, 6 do
		local direction = rng:NextUnitVector()
		local berry = part({
			Name = "Berry",
			Shape = Enum.PartType.Ball,
			Size = Vector3.new(0.6, 0.6, 0.6),
			CFrame = CFrame.new(bush.Position + direction * 2.2),
			Material = Enum.Material.SmoothPlastic,
			Color = Color3.fromRGB(200, 30, 50),
			CanCollide = false,
		})
		berry.Parent = model
	end
end

local spawnMaterials = {
	Tree = { Enum.Material.Grass },
	Rock = { Enum.Material.Grass, Enum.Material.Rock, Enum.Material.Sand },
	Bush = { Enum.Material.Grass },
}

function Resources.Spawn(kind: string)
	local ground = WorldGen.RandomSurface(spawnMaterials[kind])
	if not ground then
		return
	end

	local model = Instance.new("Model")
	model.Name = kind
	builders[kind](model, ground)
	model.WorldPivot = CFrame.new(ground)
	model:SetAttribute("Kind", kind)
	model:SetAttribute("Amount", Config.Resources[kind].Amount)
	model.Parent = folder
	basePivots[model] = model.WorldPivot
end

function Resources.SpawnAll()
	for kind, def in Config.Resources do
		for _ = 1, def.Count do
			Resources.Spawn(kind)
		end
	end
end

-- Nearest node in front of the character within `range` studs.
function Resources.FindTarget(root: BasePart, range: number): Model?
	local best, bestDistance = nil, math.huge
	for _, model in folder:GetChildren() do
		local distance = Targeting.InFront(root, model:GetPivot().Position, range)
		if distance and distance < bestDistance then
			best, bestDistance = model, distance
		end
	end
	return best
end

local function shake(model: Model)
	local base = basePivots[model]
	if not base then
		return
	end
	task.spawn(function()
		for _ = 1, 4 do
			if not model.Parent then
				return
			end
			model:PivotTo(base * CFrame.Angles(math.rad(rng:NextNumber(-3, 3)), 0, math.rad(rng:NextNumber(-3, 3))))
			task.wait(0.03)
		end
		if model.Parent then
			model:PivotTo(base)
		end
	end)
end

-- Takes resources from a node using a tool's yield table. Returns the item and amount gathered.
function Resources.Hit(model: Model, yield: { [string]: number }): (string?, number)
	local kind = model:GetAttribute("Kind")
	local def = Config.Resources[kind]
	if not def then
		return nil, 0
	end

	local remaining = model:GetAttribute("Amount") or 0
	local gathered = math.min(yield[def.Item] or 0, remaining)
	if gathered <= 0 then
		return def.Item, 0
	end

	remaining -= gathered
	if remaining <= 0 then
		basePivots[model] = nil
		model:Destroy()
		task.delay(def.Respawn, Resources.Spawn, kind)
	else
		model:SetAttribute("Amount", remaining)
		shake(model)
	end
	return def.Item, gathered
end

return Resources
