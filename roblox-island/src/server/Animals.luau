local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Targeting = require(script.Parent.Targeting)
local WorldGen = require(script.Parent.WorldGen)

local Animals = {}

export type Animal = {
	kind: string,
	model: Model,
	health: number,
	goal: Vector3?,
	idleUntil: number,
	angryAt: Player?,
	angryUntil: number,
	lastAttack: number,
}

local rng = Random.new()
local animals: { [Model]: Animal } = {}

local folder = Instance.new("Folder")
folder.Name = "Animals"
folder.Parent = workspace

local function part(model: Model, size: Vector3, offset: CFrame, color: Color3)
	local p = Instance.new("Part")
	p.Anchored = true
	p.Size = size
	p.Color = color
	p.Material = Enum.Material.Fabric
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.CFrame = offset
	p.Parent = model
end

-- Built around the origin facing -Z, then moved into place with PivotTo.
local function buildBoar(): Model
	local model = Instance.new("Model")
	model.Name = "Boar"
	local fur = Color3.fromRGB(90, 62, 45)
	local dark = Color3.fromRGB(50, 35, 28)
	part(model, Vector3.new(2.6, 2.2, 4.4), CFrame.new(0, 2.1, 0), fur)
	part(model, Vector3.new(1.9, 1.7, 1.6), CFrame.new(0, 2.3, -2.7), fur)
	part(model, Vector3.new(1, 0.8, 0.6), CFrame.new(0, 2, -3.7), dark)
	part(model, Vector3.new(0.2, 0.2, 0.7), CFrame.new(-0.5, 1.7, -3.7), Color3.fromRGB(235, 230, 210))
	part(model, Vector3.new(0.2, 0.2, 0.7), CFrame.new(0.5, 1.7, -3.7), Color3.fromRGB(235, 230, 210))
	for _, x in { -0.9, 0.9 } do
		for _, z in { -1.5, 1.5 } do
			part(model, Vector3.new(0.6, 1.2, 0.6), CFrame.new(x, 0.6, z), dark)
		end
	end
	model.WorldPivot = CFrame.new()
	return model
end

function Animals.Spawn(kind: string)
	local ground = WorldGen.RandomSurface({ Enum.Material.Grass })
	if not ground then
		return
	end
	local model = buildBoar()
	model:PivotTo(CFrame.new(ground) * CFrame.Angles(0, rng:NextNumber(0, math.pi * 2), 0))
	model:SetAttribute("Kind", kind)
	model.Parent = folder
	animals[model] = {
		kind = kind,
		model = model,
		health = Config.Animals[kind].Health,
		goal = nil,
		idleUntil = 0,
		angryAt = nil,
		angryUntil = 0,
		lastAttack = 0,
	}
end

function Animals.SpawnAll()
	for kind, def in Config.Animals do
		for _ = 1, def.Count do
			Animals.Spawn(kind)
		end
	end
end

function Animals.FindTarget(root: BasePart, range: number): (Animal?, number)
	local best, bestDistance = nil, math.huge
	for model, animal in animals do
		local distance = Targeting.InFront(root, model:GetPivot().Position, range)
		if distance and distance < bestDistance then
			best, bestDistance = animal, distance
		end
	end
	return best, bestDistance
end

local function flash(model: Model)
	local originals = {}
	for _, p in model:GetChildren() do
		if p:IsA("BasePart") then
			originals[p] = p.Color
			p.Color = Color3.fromRGB(200, 60, 60)
		end
	end
	task.delay(0.12, function()
		for p, color in originals do
			p.Color = color
		end
	end)
end

-- Returns the meat dropped if this hit killed the animal, otherwise 0.
function Animals.Damage(animal: Animal, amount: number, attacker: Player): number
	if not animals[animal.model] then
		return 0
	end
	local def = Config.Animals[animal.kind]
	animal.health -= amount
	if animal.health <= 0 then
		animals[animal.model] = nil
		animal.model:Destroy()
		task.delay(def.Respawn, Animals.Spawn, animal.kind)
		return def.Meat
	end
	animal.angryAt = attacker
	animal.angryUntil = os.clock() + def.AngryTime
	flash(animal.model)
	return 0
end

local function rootOf(player: Player?): BasePart?
	local character = player and player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if not humanoid or humanoid.Health <= 0 then
		return nil
	end
	return character:FindFirstChild("HumanoidRootPart") :: BasePart?
end

local function pickWanderGoal(from: Vector3): Vector3?
	local angle = rng:NextNumber(0, math.pi * 2)
	local distance = rng:NextNumber(10, 30)
	local ground = WorldGen.GroundBelow(from + Vector3.new(math.cos(angle) * distance, 0, math.sin(angle) * distance))
	if ground and ground.Y > Config.Island.SeaLevel + 1 then
		return ground
	end
	return nil
end

local function step(animal: Animal, dt: number, now: number)
	local def = Config.Animals[animal.kind]
	local position = animal.model:GetPivot().Position
	local speed = def.WalkSpeed
	local goal = animal.goal

	local enemy = if now < animal.angryUntil then rootOf(animal.angryAt) else nil
	if enemy and (enemy.Position - position).Magnitude < 80 then
		goal = enemy.Position
		speed = def.RunSpeed
		local reach = Vector3.new(enemy.Position.X - position.X, 0, enemy.Position.Z - position.Z).Magnitude
		if reach <= def.AttackRange and now - animal.lastAttack >= def.AttackCooldown then
			animal.lastAttack = now
			local humanoid = enemy.Parent and enemy.Parent:FindFirstChildOfClass("Humanoid")
			if humanoid then
				humanoid:TakeDamage(def.Damage)
			end
		end
		if reach <= def.AttackRange * 0.8 then
			return
		end
	else
		animal.angryAt = nil
		if now < animal.idleUntil then
			return
		end
		if not goal then
			animal.goal = pickWanderGoal(position)
			if not animal.goal then
				animal.idleUntil = now + 1
			end
			return
		end
	end

	local flat = Vector3.new(goal.X - position.X, 0, goal.Z - position.Z)
	if flat.Magnitude < 1 then
		animal.goal = nil
		animal.idleUntil = now + rng:NextNumber(1, 5)
		return
	end

	local direction = flat.Unit
	local nextGround = WorldGen.GroundBelow(position + direction * math.min(speed * dt, flat.Magnitude))
	if not nextGround or nextGround.Y < Config.Island.SeaLevel + 0.5 then
		animal.goal = nil
		animal.idleUntil = now + 1
		return
	end
	animal.model:PivotTo(CFrame.lookAt(nextGround, nextGround + direction))
end

function Animals.Run()
	task.spawn(function()
		while true do
			local dt = task.wait(0.1)
			local now = os.clock()
			for _, animal in animals do
				step(animal, dt, now)
			end
		end
	end)

	Players.PlayerRemoving:Connect(function(player)
		for _, animal in animals do
			if animal.angryAt == player then
				animal.angryAt = nil
			end
		end
	end)
end

return Animals
